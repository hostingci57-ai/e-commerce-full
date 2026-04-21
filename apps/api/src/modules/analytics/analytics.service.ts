import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { withTenant } from '@ecf/db';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import type {
  AlertsResponse,
  AnalyticsDateRange,
  CategoryBreakdownRow,
  Granularity,
  KpiResponse,
  RevenuePoint,
  StatusHistogramRow,
  TopCustomerRow,
  TopProductRow,
} from './analytics.types';

/**
 * Orders considered "realised revenue" — everything past the checkout success
 * gate. Matches the FSD 5.1 revenue definition. Refund states are intentionally
 * excluded; full/partial refunds are accounted for via the Refund table in a
 * later phase.
 */
const REVENUE_STATUSES = [
  'payment_success',
  'preparing',
  'shipped',
  'delivered',
  'closed',
] as const;

/**
 * Default low-stock threshold for alerts. Tenant-override can be added via
 * tenant_settings in a future iteration (YAGNI for MVP).
 */
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class AnalyticsService {
  constructor(private readonly ctx: TenantContextService) {}

  // ---------------------------------------------------------------------------
  // Scope helpers
  // ---------------------------------------------------------------------------

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) {
      throw new NotFoundException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return id;
  }

  /**
   * Normalise {from,to} into UTC Date objects. Defaults cover the last 30
   * calendar days (from = today 30 days ago, to = now). Exposed so controllers
   * can echo the applied range back to the client.
   */
  resolveRange(range: AnalyticsDateRange): { from: Date; to: Date } {
    const to = range.to ? new Date(range.to) : new Date();
    const from = range.from
      ? new Date(range.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        code: 'invalid_date_range',
        message: 'from/to must be valid ISO-8601 timestamps',
      });
    }
    if (from > to) {
      throw new BadRequestException({
        code: 'invalid_date_range',
        message: 'from must be before to',
      });
    }
    return { from, to };
  }

  // ---------------------------------------------------------------------------
  // KPIs
  // ---------------------------------------------------------------------------

  /**
   * Headline KPI numbers for the dashboard. Revenue / orders are computed from
   * the revenue-state filter; newCustomerCount is distinct Customer.createdAt
   * in-range; conversionRate ≈ orderCount / sessionCount (session count
   * currently stubbed with `orderCount * 20` — real analytics warehouse lands
   * in a later phase).
   */
  async getKpis(range: AnalyticsDateRange): Promise<KpiResponse> {
    const tenantId = this.requireTenant();
    const { from, to } = this.resolveRange(range);

    return withTenant({ tenantId }, async (tx) => {
      const revAgg = (
        await tx.$queryRawUnsafe<
          Array<{ revenue: bigint | null; order_count: bigint }>
        >(
          `SELECT COALESCE(SUM("totalMinor"), 0)::bigint AS revenue,
                  COUNT(*)::bigint                      AS order_count
           FROM orders
           WHERE status::text = ANY($1::text[])
             AND "createdAt" BETWEEN $2 AND $3
             AND is_draft = false`,
          REVENUE_STATUSES as unknown as string[],
          from,
          to,
        )
      )[0];

      const custAgg = (
        await tx.$queryRawUnsafe<Array<{ new_count: bigint }>>(
          `SELECT COUNT(*)::bigint AS new_count
           FROM customers
           WHERE "createdAt" BETWEEN $1 AND $2`,
          from,
          to,
        )
      )[0];

      const revenueMinor = BigInt(revAgg?.revenue ?? 0n);
      const orderCount = Number(revAgg?.order_count ?? 0n);
      const newCustomerCount = Number(custAgg?.new_count ?? 0n);

      // Sessions stub — assume 5% baseline conversion so the KPI card shows
      // plausible numbers. Replace when a real web-analytics ingest lands.
      const sessionCount = Math.max(orderCount * 20, orderCount);
      const conversionRate =
        sessionCount > 0 ? Math.min(orderCount / sessionCount, 1) : 0;
      const averageOrderValueMinor =
        orderCount > 0 ? revenueMinor / BigInt(orderCount) : 0n;

      return {
        revenueMinor: revenueMinor.toString(),
        orderCount,
        newCustomerCount,
        conversionRate,
        averageOrderValueMinor: averageOrderValueMinor.toString(),
        sessionCount,
        from: from.toISOString(),
        to: to.toISOString(),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Revenue time series
  // ---------------------------------------------------------------------------

  /**
   * Bucketed revenue + order counts. Uses Postgres `date_trunc` so the bucket
   * boundaries follow ISO week / UTC day semantics consistently.
   */
  async getRevenueTimeSeries(
    range: AnalyticsDateRange & { granularity?: Granularity },
  ): Promise<RevenuePoint[]> {
    const tenantId = this.requireTenant();
    const { from, to } = this.resolveRange(range);
    const granularity: Granularity = range.granularity ?? 'day';
    const truncUnit =
      granularity === 'month' ? 'month' : granularity === 'week' ? 'week' : 'day';

    return withTenant({ tenantId }, async (tx) => {
      // `truncUnit` is whitelisted above — safe to interpolate. All values use
      // parameter binding.
      const rows = await tx.$queryRawUnsafe<
        Array<{ period: Date; revenue: bigint | null; order_count: bigint }>
      >(
        `SELECT date_trunc('${truncUnit}', "createdAt") AS period,
                COALESCE(SUM("totalMinor"), 0)::bigint  AS revenue,
                COUNT(*)::bigint                        AS order_count
         FROM orders
         WHERE status::text = ANY($1::text[])
           AND "createdAt" BETWEEN $2 AND $3
           AND is_draft = false
         GROUP BY period
         ORDER BY period ASC`,
        REVENUE_STATUSES as unknown as string[],
        from,
        to,
      );

      return rows.map((r) => ({
        period: new Date(r.period).toISOString(),
        revenueMinor: BigInt(r.revenue ?? 0n).toString(),
        orderCount: Number(r.order_count ?? 0n),
      }));
    });
  }

  // ---------------------------------------------------------------------------
  // Top products
  // ---------------------------------------------------------------------------

  async getTopProducts(
    range: AnalyticsDateRange & { limit?: number },
  ): Promise<TopProductRow[]> {
    const tenantId = this.requireTenant();
    const { from, to } = this.resolveRange(range);
    const limit = Math.max(1, Math.min(range.limit ?? 5, 50));

    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          product_id: string | null;
          title: string | null;
          total_quantity: bigint;
          total_revenue: bigint;
        }>
      >(
        `SELECT ol."productId"                            AS product_id,
                COALESCE(p.title, MAX(ol."titleSnapshot")) AS title,
                SUM(ol.quantity)::bigint                  AS total_quantity,
                SUM(ol."totalMinorUnits")::bigint         AS total_revenue
         FROM order_lines ol
         JOIN orders o
           ON o.id = ol."orderId" AND o."tenantId" = ol."tenantId"
         LEFT JOIN products p
           ON p.id = ol."productId" AND p."tenantId" = ol."tenantId"
         WHERE o.status::text = ANY($1::text[])
           AND o."createdAt" BETWEEN $2 AND $3
           AND o.is_draft = false
           AND ol."productId" IS NOT NULL
         GROUP BY ol."productId", p.title
         ORDER BY total_revenue DESC
         LIMIT $4`,
        REVENUE_STATUSES as unknown as string[],
        from,
        to,
        limit,
      );

      return rows.map((r) => ({
        productId: r.product_id ?? '',
        title: r.title ?? '',
        totalQuantity: Number(r.total_quantity ?? 0n),
        totalRevenueMinor: BigInt(r.total_revenue ?? 0n).toString(),
      }));
    });
  }

  // ---------------------------------------------------------------------------
  // Top customers
  // ---------------------------------------------------------------------------

  async getTopCustomers(
    range: AnalyticsDateRange & { limit?: number },
  ): Promise<TopCustomerRow[]> {
    const tenantId = this.requireTenant();
    const { from, to } = this.resolveRange(range);
    const limit = Math.max(1, Math.min(range.limit ?? 5, 50));

    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          customer_id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          order_count: bigint;
          total_spent: bigint;
        }>
      >(
        `SELECT c.id                                  AS customer_id,
                c.email                               AS email,
                c."firstName"                         AS first_name,
                c."lastName"                          AS last_name,
                COUNT(o.id)::bigint                   AS order_count,
                SUM(o."totalMinor")::bigint           AS total_spent
         FROM orders o
         JOIN customers c
           ON c.id = o."customerId" AND c."tenantId" = o."tenantId"
         WHERE o.status::text = ANY($1::text[])
           AND o."createdAt" BETWEEN $2 AND $3
           AND o.is_draft = false
           AND o."customerId" IS NOT NULL
         GROUP BY c.id, c.email, c."firstName", c."lastName"
         ORDER BY total_spent DESC
         LIMIT $4`,
        REVENUE_STATUSES as unknown as string[],
        from,
        to,
        limit,
      );

      return rows.map((r) => ({
        customerId: r.customer_id,
        email: r.email,
        name: [r.first_name, r.last_name].filter(Boolean).join(' '),
        orderCount: Number(r.order_count ?? 0n),
        totalSpentMinor: BigInt(r.total_spent ?? 0n).toString(),
      }));
    });
  }

  // ---------------------------------------------------------------------------
  // Sales by category
  // ---------------------------------------------------------------------------

  async getSalesByCategory(
    range: AnalyticsDateRange,
  ): Promise<CategoryBreakdownRow[]> {
    const tenantId = this.requireTenant();
    const { from, to } = this.resolveRange(range);

    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          category_id: string | null;
          name: string | null;
          total_revenue: bigint;
          order_count: bigint;
        }>
      >(
        `SELECT cat.id                                      AS category_id,
                cat.name                                    AS name,
                SUM(ol."totalMinorUnits")::bigint           AS total_revenue,
                COUNT(DISTINCT o.id)::bigint                AS order_count
         FROM order_lines ol
         JOIN orders o
           ON o.id = ol."orderId" AND o."tenantId" = ol."tenantId"
         JOIN category_products cp
           ON cp."productId" = ol."productId" AND cp."tenantId" = ol."tenantId"
         JOIN categories cat
           ON cat.id = cp."categoryId" AND cat."tenantId" = ol."tenantId"
         WHERE o.status::text = ANY($1::text[])
           AND o."createdAt" BETWEEN $2 AND $3
           AND o.is_draft = false
         GROUP BY cat.id, cat.name
         ORDER BY total_revenue DESC`,
        REVENUE_STATUSES as unknown as string[],
        from,
        to,
      );

      return rows.map((r) => ({
        categoryId: r.category_id ?? '',
        name: r.name ?? '(uncategorised)',
        totalRevenueMinor: BigInt(r.total_revenue ?? 0n).toString(),
        orderCount: Number(r.order_count ?? 0n),
      }));
    });
  }

  // ---------------------------------------------------------------------------
  // Orders by status (histogram)
  // ---------------------------------------------------------------------------

  async getOrdersByStatus(
    range: AnalyticsDateRange,
  ): Promise<StatusHistogramRow[]> {
    const tenantId = this.requireTenant();
    const { from, to } = this.resolveRange(range);

    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{ status: string; count: bigint }>
      >(
        `SELECT status::text AS status,
                COUNT(*)::bigint AS count
         FROM orders
         WHERE "createdAt" BETWEEN $1 AND $2
           AND is_draft = false
         GROUP BY status
         ORDER BY count DESC`,
        from,
        to,
      );

      return rows.map((r) => ({
        status: r.status,
        count: Number(r.count ?? 0n),
      }));
    });
  }

  // ---------------------------------------------------------------------------
  // Alerts (for the dashboard alert widget)
  // ---------------------------------------------------------------------------

  async getAlerts(): Promise<AlertsResponse> {
    const tenantId = this.requireTenant();

    return withTenant({ tenantId }, async (tx) => {
      const lowStock = (
        await tx.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*)::bigint AS c
           FROM product_variants
           WHERE ("stockOnHand" - "stockReserved") <= $1`,
          DEFAULT_LOW_STOCK_THRESHOLD,
        )
      )[0];
      const pendingRefund = (
        await tx.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*)::bigint AS c
           FROM refund_requests
           WHERE status = 'PENDING'`,
        )
      )[0];
      const bankTransfer = (
        await tx.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*)::bigint AS c
           FROM orders
           WHERE status = 'pending_payment'
             AND "paymentProvider" = 'bank_transfer'
             AND is_draft = false`,
        )
      )[0];

      return {
        lowStockCount: Number(lowStock?.c ?? 0n),
        pendingRefundCount: Number(pendingRefund?.c ?? 0n),
        abandonedCartCount: 0, // stub — filled by abandoned-cart job in Faz 8b
        bankTransferPendingCount: Number(bankTransfer?.c ?? 0n),
      };
    });
  }
}

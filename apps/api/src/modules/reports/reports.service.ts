import { Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { withTenant } from '@ecf/db';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/**
 * Streaming CSV report generators. Each public method returns a Node.js
 * Readable that emits UTF-8 CSV bytes — the controller pipes it straight to
 * `FastifyReply` so we stay memory-efficient for large tenants.
 *
 * CSV fields that may contain commas, quotes, or newlines are RFC-4180
 * quoted; BigInt money is serialised in minor units (no locale / decimal
 * conversion — the downstream spreadsheet can divide by 100).
 */

function csvEscape(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'bigint' ? value.toString() : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(values: Array<string | number | bigint | null | undefined>): string {
  return values.map(csvEscape).join(',') + '\n';
}

const BOM = '\uFEFF';

@Injectable()
export class ReportsService {
  constructor(private readonly ctx: TenantContextService) {}

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

  private resolveRange(range: { from?: string; to?: string }) {
    const to = range.to ? new Date(range.to) : new Date();
    const from = range.from
      ? new Date(range.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  // ---------------------------------------------------------------------------
  // Orders CSV
  // ---------------------------------------------------------------------------

  ordersStream(params: {
    from?: string;
    to?: string;
    status?: string;
  }): Readable {
    const tenantId = this.requireTenant();
    const { from, to } = this.resolveRange(params);
    const status = params.status ?? null;

    const stream = new Readable({ read() {} });
    stream.push(
      BOM +
        row([
          'order_number',
          'customer_email',
          'customer_name',
          'status',
          'payment_provider',
          'currency',
          'subtotal_minor',
          'shipping_minor',
          'discount_minor',
          'tax_minor',
          'total_minor',
          'line_count',
          'placed_at',
          'created_at',
        ]),
    );

    void withTenant({ tenantId }, async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          order_number: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          guest_email: string | null;
          status: string;
          payment_provider: string;
          currency: string;
          subtotal_minor: bigint;
          shipping_minor: bigint;
          discount_minor: bigint;
          tax_minor: bigint;
          total_minor: bigint;
          line_count: bigint;
          placed_at: Date;
          created_at: Date;
        }>
      >(
        `SELECT o."orderNumber"                                 AS order_number,
                c.email                                         AS email,
                c."firstName"                                   AS first_name,
                c."lastName"                                    AS last_name,
                o."guestEmail"                                  AS guest_email,
                o.status::text                                  AS status,
                o."paymentProvider"                             AS payment_provider,
                o.currency                                      AS currency,
                o."subtotalMinor"                               AS subtotal_minor,
                o."shippingMinor"                               AS shipping_minor,
                o."discountMinor"                               AS discount_minor,
                o."taxMinor"                                    AS tax_minor,
                o."totalMinor"                                  AS total_minor,
                (SELECT COUNT(*) FROM order_lines ol
                  WHERE ol."orderId" = o.id AND ol."tenantId" = o."tenantId")::bigint
                                                                AS line_count,
                o."placedAt"                                    AS placed_at,
                o."createdAt"                                   AS created_at
         FROM orders o
         LEFT JOIN customers c
           ON c.id = o."customerId" AND c."tenantId" = o."tenantId"
         WHERE o."createdAt" BETWEEN $1 AND $2
           AND o.is_draft = false
           AND ($3::text IS NULL OR o.status::text = $3::text)
         ORDER BY o."createdAt" DESC`,
        from,
        to,
        status,
      );

      for (const r of rows) {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ');
        stream.push(
          row([
            r.order_number,
            r.email ?? r.guest_email ?? '',
            name,
            r.status,
            r.payment_provider,
            r.currency,
            r.subtotal_minor,
            r.shipping_minor,
            r.discount_minor,
            r.tax_minor,
            r.total_minor,
            r.line_count,
            r.placed_at?.toISOString?.() ?? '',
            r.created_at?.toISOString?.() ?? '',
          ]),
        );
      }
      stream.push(null);
    }).catch((err) => {
      stream.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    return stream;
  }

  // ---------------------------------------------------------------------------
  // Sales (daily aggregate) CSV
  // ---------------------------------------------------------------------------

  salesStream(params: { from?: string; to?: string }): Readable {
    const tenantId = this.requireTenant();
    const { from, to } = this.resolveRange(params);

    const stream = new Readable({ read() {} });
    stream.push(
      BOM +
        row([
          'date',
          'order_count',
          'revenue_minor',
          'currency',
          'average_order_value_minor',
        ]),
    );

    void withTenant({ tenantId }, async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          day: Date;
          order_count: bigint;
          revenue: bigint;
          currency: string;
        }>
      >(
        `SELECT date_trunc('day', "createdAt") AS day,
                COUNT(*)::bigint               AS order_count,
                COALESCE(SUM("totalMinor"), 0)::bigint AS revenue,
                MIN(currency)                  AS currency
         FROM orders
         WHERE "createdAt" BETWEEN $1 AND $2
           AND is_draft = false
           AND status::text IN ('payment_success','preparing','shipped','delivered','closed')
         GROUP BY day
         ORDER BY day ASC`,
        from,
        to,
      );

      for (const r of rows) {
        const aov =
          r.order_count > 0n
            ? r.revenue / r.order_count
            : 0n;
        stream.push(
          row([
            r.day?.toISOString?.().slice(0, 10) ?? '',
            Number(r.order_count ?? 0n),
            r.revenue,
            r.currency,
            aov,
          ]),
        );
      }
      stream.push(null);
    }).catch((err) => {
      stream.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    return stream;
  }

  // ---------------------------------------------------------------------------
  // Customers (LTV) CSV
  // ---------------------------------------------------------------------------

  customersStream(): Readable {
    const tenantId = this.requireTenant();

    const stream = new Readable({ read() {} });
    stream.push(
      BOM +
        row([
          'customer_id',
          'email',
          'first_name',
          'last_name',
          'order_count',
          'total_spent_minor',
          'last_order_at',
          'created_at',
        ]),
    );

    void withTenant({ tenantId }, async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          order_count: bigint;
          total_spent: bigint;
          last_order_at: Date | null;
          created_at: Date;
        }>
      >(
        `SELECT c.id                                          AS id,
                c.email                                       AS email,
                c."firstName"                                 AS first_name,
                c."lastName"                                  AS last_name,
                COALESCE(agg.order_count, 0)::bigint          AS order_count,
                COALESCE(agg.total_spent, 0)::bigint          AS total_spent,
                agg.last_order_at                             AS last_order_at,
                c."createdAt"                                 AS created_at
         FROM customers c
         LEFT JOIN (
           SELECT "customerId"               AS customer_id,
                  COUNT(*)::bigint           AS order_count,
                  SUM("totalMinor")::bigint  AS total_spent,
                  MAX("placedAt")            AS last_order_at
           FROM orders
           WHERE is_draft = false
             AND status::text IN ('payment_success','preparing','shipped','delivered','closed')
           GROUP BY "customerId"
         ) agg ON agg.customer_id = c.id
         ORDER BY agg.total_spent DESC NULLS LAST, c."createdAt" DESC`,
      );

      for (const r of rows) {
        stream.push(
          row([
            r.id,
            r.email,
            r.first_name,
            r.last_name,
            Number(r.order_count ?? 0n),
            r.total_spent,
            r.last_order_at?.toISOString?.() ?? '',
            r.created_at?.toISOString?.() ?? '',
          ]),
        );
      }
      stream.push(null);
    }).catch((err) => {
      stream.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    return stream;
  }
}

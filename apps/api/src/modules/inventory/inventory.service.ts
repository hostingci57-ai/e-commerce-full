import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InventoryMovementType, Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  AdjustStockInput,
  BulkImportInput,
  ListInventoryLevelsQuery,
  ListMovementsQuery,
  UpdateInventoryLevelInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { OutboxService } from '../../common/outbox/outbox.service';

export interface ReserveLine {
  variantId: string;
  quantity: number;
}

export interface ReservationResult {
  reservationIds: string[];
  expiresAt: Date;
}

/**
 * Inventory service (FSD 5.2.7 + 11).
 *
 * Canonical stock lives in two tables kept in lock-step by every mutation:
 *
 *   product_variants.stockOnHand / stockReserved   — legacy columns read by
 *                                                    cart + products today
 *   inventory_levels.stockOnHand / stockReserved   — new canonical rows with
 *                                                    per-variant threshold +
 *                                                    lastUpdatedAt audit
 *
 * Every delta also appends one `inventory_movements` row so the full history
 * (why stock is where it is) can always be reconstructed.
 *
 * All writes run inside `withTenant(... Serializable)` — concurrent
 * last-unit sales serialise and the wrapper re-reads to detect OOS.
 *
 * Outbox events:
 *   inventory.low_stock   — emitted when on-hand crosses at/below threshold
 *   inventory.out_of_stock— emitted when on-hand reaches 0
 *   inventory.movement    — emitted for every movement (webhooks/analytics)
 *
 * Low-stock events are de-duplicated per variant per day so repeated adjusts
 * won't spam subscribers (idempotency key = variantId+YYYYMMDD).
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly outbox: OutboxService,
  ) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) {
      throw new BadRequestException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return id;
  }

  // -------------------------------------------------------------------------
  // Internal helpers (tx-scoped)
  // -------------------------------------------------------------------------

  /**
   * Ensure an InventoryLevel row exists for `variantId`. Seeds from the
   * variant's legacy columns on first touch so old data doesn't drift.
   */
  private async ensureLevel(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantId: string,
  ): Promise<{ stockOnHand: number; stockReserved: number; lowStockThreshold: number }> {
    const existing = await tx.inventoryLevel.findUnique({
      where: { tenantId_variantId: { tenantId, variantId } },
      select: {
        stockOnHand: true,
        stockReserved: true,
        lowStockThreshold: true,
      },
    });
    if (existing) return existing;

    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { tenantId: true, stockOnHand: true, stockReserved: true },
    });
    if (!variant || variant.tenantId !== tenantId) {
      throw new NotFoundException({
        code: 'variant_not_found',
        message: `Variant ${variantId} not found`,
      });
    }
    const created = await tx.inventoryLevel.create({
      data: {
        tenantId,
        variantId,
        stockOnHand: variant.stockOnHand,
        stockReserved: variant.stockReserved,
      },
      select: {
        stockOnHand: true,
        stockReserved: true,
        lowStockThreshold: true,
      },
    });
    return created;
  }

  /**
   * Apply an on-hand / reserved delta to BOTH tables atomically + append an
   * InventoryMovement row. Returns the post-write level so callers can emit
   * low-stock / OOS events.
   */
  private async applyDelta(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      variantId: string;
      onHandDelta: number;
      reservedDelta: number;
      movementType: InventoryMovementType;
      movementQty: number;
      reason?: string | null;
      reference?: string | null;
      note?: string | null;
      userId?: string | null;
    },
  ): Promise<{ stockOnHand: number; stockReserved: number; lowStockThreshold: number; available: number }> {
    await this.ensureLevel(tx, args.tenantId, args.variantId);

    // Also mirror the change into the legacy ProductVariant columns so cart,
    // checkout, and the products service continue to read a consistent value.
    await tx.productVariant.update({
      where: { id: args.variantId },
      data: {
        stockOnHand: { increment: args.onHandDelta },
        stockReserved: { increment: args.reservedDelta },
      },
    });

    const level = await tx.inventoryLevel.update({
      where: { tenantId_variantId: { tenantId: args.tenantId, variantId: args.variantId } },
      data: {
        stockOnHand: { increment: args.onHandDelta },
        stockReserved: { increment: args.reservedDelta },
      },
      select: {
        stockOnHand: true,
        stockReserved: true,
        lowStockThreshold: true,
      },
    });

    if (level.stockOnHand < 0) {
      throw new BadRequestException({
        code: 'negative_stock',
        message: 'Adjustment would drive stock below zero',
      });
    }
    if (level.stockReserved < 0) {
      throw new BadRequestException({
        code: 'negative_reserved',
        message: 'Reserve release would go below zero',
      });
    }
    if (level.stockReserved > level.stockOnHand) {
      throw new BadRequestException({
        code: 'out_of_stock',
        message: `Reserved exceeds on-hand for variant ${args.variantId}`,
      });
    }

    await tx.inventoryMovement.create({
      data: {
        tenantId: args.tenantId,
        variantId: args.variantId,
        type: args.movementType,
        quantity: args.movementQty,
        reason: args.reason ?? null,
        reference: args.reference ?? null,
        note: args.note ?? null,
        createdBy: args.userId ?? null,
      },
    });

    return { ...level, available: level.stockOnHand - level.stockReserved };
  }

  // -------------------------------------------------------------------------
  // Reservation / confirm / release (existing callers)
  // -------------------------------------------------------------------------

  async reserve(
    lines: ReserveLine[],
    sessionId: string,
    ttlMinutes = 15,
  ): Promise<ReservationResult> {
    if (lines.length === 0) {
      throw new BadRequestException({
        code: 'no_lines',
        message: 'Cannot reserve an empty cart',
      });
    }
    const tenantId = this.requireTenant();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    return withTenant(
      { tenantId, userId: this.ctx.userId, isolationLevel: 'Serializable' },
      async (tx) => {
        const ids: string[] = [];
        for (const line of lines) {
          await this.applyDelta(tx, {
            tenantId,
            variantId: line.variantId,
            onHandDelta: 0,
            reservedDelta: line.quantity,
            movementType: 'RESERVATION',
            movementQty: -line.quantity,
            reason: 'order_reserved',
            reference: sessionId,
            userId: this.ctx.userId,
          });
          const row = await tx.inventoryReservation.create({
            data: {
              tenantId,
              variantId: line.variantId,
              sessionId,
              quantity: line.quantity,
              expiresAt,
            },
            select: { id: true },
          });
          ids.push(row.id);
        }
        return { reservationIds: ids, expiresAt };
      },
    );
  }

  async confirm(sessionId: string, orderId: string): Promise<void> {
    const tenantId = this.requireTenant();
    await withTenant(
      { tenantId, userId: this.ctx.userId, isolationLevel: 'Serializable' },
      async (tx) => {
        const reservations = await tx.inventoryReservation.findMany({
          where: { tenantId, sessionId, releasedAt: null },
        });
        const affected: { variantId: string; quantity: number }[] = [];
        for (const r of reservations) {
          const level = await this.applyDelta(tx, {
            tenantId,
            variantId: r.variantId,
            onHandDelta: -r.quantity,
            reservedDelta: -r.quantity,
            movementType: 'FULFILLMENT',
            movementQty: -r.quantity,
            reason: 'order_fulfilled',
            reference: orderId,
            userId: this.ctx.userId,
          });
          await tx.inventoryReservation.update({
            where: { id: r.id },
            data: { releasedAt: new Date(), orderId },
          });
          affected.push({ variantId: r.variantId, quantity: r.quantity });
          await this.emitThresholdEvents(tx, tenantId, r.variantId, level);
        }
      },
    );
  }

  async release(sessionId: string): Promise<void> {
    const tenantId = this.requireTenant();
    await withTenant(
      { tenantId, userId: this.ctx.userId, isolationLevel: 'Serializable' },
      async (tx) => {
        const reservations = await tx.inventoryReservation.findMany({
          where: { tenantId, sessionId, releasedAt: null },
        });
        for (const r of reservations) {
          await this.applyDelta(tx, {
            tenantId,
            variantId: r.variantId,
            onHandDelta: 0,
            reservedDelta: -r.quantity,
            movementType: 'RELEASE',
            movementQty: r.quantity,
            reason: 'cart_released',
            reference: sessionId,
            userId: this.ctx.userId,
          });
          await tx.inventoryReservation.update({
            where: { id: r.id },
            data: { releasedAt: new Date() },
          });
        }
      },
    );
  }

  // -------------------------------------------------------------------------
  // Admin: adjust / threshold / current / list / bulk-import
  // -------------------------------------------------------------------------

  async adjust(input: AdjustStockInput) {
    const tenantId = this.requireTenant();
    return withTenant(
      { tenantId, userId: this.ctx.userId, isolationLevel: 'Serializable' },
      async (tx) => {
        // INITIAL path uses its own movement type so reports can separate
        // "initial import" from "operator adjustment" later.
        const type: InventoryMovementType =
          input.reason === 'initial'
            ? 'INITIAL'
            : input.reason === 'damage'
              ? 'DAMAGE'
              : input.reason === 'return'
                ? 'RETURN'
                : 'ADJUSTMENT';
        const level = await this.applyDelta(tx, {
          tenantId,
          variantId: input.variantId,
          onHandDelta: input.delta,
          reservedDelta: 0,
          movementType: type,
          movementQty: input.delta,
          reason: input.reason ?? 'manual_adjustment',
          reference: input.reference ?? null,
          note: input.note ?? null,
          userId: this.ctx.userId,
        });
        await this.emitThresholdEvents(tx, tenantId, input.variantId, level);
        return { variantId: input.variantId, ...level };
      },
    );
  }

  async getCurrentStock(variantId: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const level = await this.ensureLevel(tx, tenantId, variantId);
      return {
        variantId,
        stockOnHand: level.stockOnHand,
        stockReserved: level.stockReserved,
        available: level.stockOnHand - level.stockReserved,
        lowStockThreshold: level.lowStockThreshold,
      };
    });
  }

  async updateThreshold(variantId: string, input: UpdateInventoryLevelInput) {
    const tenantId = this.requireTenant();
    if (input.lowStockThreshold === undefined) {
      throw new BadRequestException({
        code: 'no_changes',
        message: 'lowStockThreshold is required',
      });
    }
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      await this.ensureLevel(tx, tenantId, variantId);
      const level = await tx.inventoryLevel.update({
        where: { tenantId_variantId: { tenantId, variantId } },
        data: { lowStockThreshold: input.lowStockThreshold },
      });
      return {
        variantId,
        stockOnHand: level.stockOnHand,
        stockReserved: level.stockReserved,
        lowStockThreshold: level.lowStockThreshold,
      };
    });
  }

  async listLevels(query: ListInventoryLevelsQuery) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      // Build a raw-ish level list joined with variant + product for the UI.
      // We paginate variants, then left-join InventoryLevel — variants with no
      // level yet (e.g. freshly seeded) still appear with a default zero row.
      const variantWhere: Prisma.ProductVariantWhereInput = {};
      if (query.query) {
        variantWhere.OR = [
          { sku: { contains: query.query, mode: 'insensitive' } },
          {
            product: {
              title: { contains: query.query, mode: 'insensitive' },
            },
          },
        ];
      }
      const total = await tx.productVariant.count({ where: variantWhere });
      const skip = (query.page - 1) * query.limit;
      const variants = await tx.productVariant.findMany({
        where: variantWhere,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: query.limit,
        select: {
          id: true,
          sku: true,
          priceMinorUnits: true,
          currency: true,
          stockOnHand: true,
          stockReserved: true,
          product: { select: { id: true, slug: true, title: true } },
        },
      });
      const ids = variants.map((v) => v.id);
      const levels = ids.length
        ? await tx.inventoryLevel.findMany({
            where: { tenantId, variantId: { in: ids } },
          })
        : [];
      const levelMap = new Map(levels.map((l) => [l.variantId, l]));
      const items = variants.map((v) => {
        const l = levelMap.get(v.id);
        const onHand = l?.stockOnHand ?? v.stockOnHand;
        const reserved = l?.stockReserved ?? v.stockReserved;
        const threshold = l?.lowStockThreshold ?? 5;
        const available = onHand - reserved;
        const status: 'in_stock' | 'low' | 'out' =
          available <= 0 ? 'out' : available <= threshold ? 'low' : 'in_stock';
        return {
          variantId: v.id,
          sku: v.sku,
          productId: v.product.id,
          productSlug: v.product.slug,
          productTitle: v.product.title,
          priceMinorUnits: v.priceMinorUnits.toString(),
          currency: v.currency,
          stockOnHand: onHand,
          stockReserved: reserved,
          available,
          lowStockThreshold: threshold,
          status,
        };
      });
      const filtered = items.filter((i) => {
        if (query.lowStock && !(i.status === 'low' || i.status === 'out')) return false;
        if (query.outOfStock && i.status !== 'out') return false;
        return true;
      });
      return {
        items: filtered,
        total,
        page: query.page,
        pageSize: query.limit,
      };
    });
  }

  async listLowStock(limit = 200) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      // We don't have per-row comparison in Prisma where; use $queryRaw.
      const rows = await tx.$queryRaw<
        Array<{
          variantId: string;
          sku: string;
          productTitle: string;
          stockOnHand: number;
          stockReserved: number;
          lowStockThreshold: number;
        }>
      >`
        SELECT
          l.variant_id        AS "variantId",
          v.sku               AS "sku",
          p.title             AS "productTitle",
          l.stock_on_hand     AS "stockOnHand",
          l.stock_reserved    AS "stockReserved",
          l.low_stock_threshold AS "lowStockThreshold"
        FROM inventory_levels l
        JOIN product_variants v ON v.id = l.variant_id AND v.tenant_id = l.tenant_id
        JOIN products p ON p.id = v.product_id AND p.tenant_id = l.tenant_id
        WHERE l.tenant_id = ${tenantId}::uuid
          AND (l.stock_on_hand - l.stock_reserved) <= l.low_stock_threshold
        ORDER BY (l.stock_on_hand - l.stock_reserved) ASC, v.sku ASC
        LIMIT ${limit}
      `;
      return rows.map((r) => ({
        ...r,
        available: r.stockOnHand - r.stockReserved,
      }));
    });
  }

  async listMovements(query: ListMovementsQuery) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const where: Prisma.InventoryMovementWhereInput = { tenantId };
      if (query.variantId) where.variantId = query.variantId;
      if (query.type) where.type = query.type;
      if (query.from || query.to) {
        where.createdAt = {};
        if (query.from) where.createdAt.gte = new Date(query.from);
        if (query.to) where.createdAt.lte = new Date(query.to);
      }
      const total = await tx.inventoryMovement.count({ where });
      const skip = (query.page - 1) * query.limit;
      const rows = await tx.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      });
      return {
        items: rows,
        total,
        page: query.page,
        pageSize: query.limit,
      };
    });
  }

  async bulkImport(input: BulkImportInput) {
    const tenantId = this.requireTenant();
    return withTenant(
      { tenantId, userId: this.ctx.userId, isolationLevel: 'Serializable' },
      async (tx) => {
        const failed: Array<{ sku: string; reason: string }> = [];
        let succeeded = 0;
        for (const row of input.items) {
          const variant = await tx.productVariant.findUnique({
            where: { tenantId_sku: { tenantId, sku: row.variantSku } },
            select: { id: true },
          });
          if (!variant) {
            failed.push({ sku: row.variantSku, reason: 'variant_not_found' });
            continue;
          }
          const current = await this.ensureLevel(tx, tenantId, variant.id);
          const delta = row.stockOnHand - current.stockOnHand;
          if (delta !== 0) {
            await this.applyDelta(tx, {
              tenantId,
              variantId: variant.id,
              onHandDelta: delta,
              reservedDelta: 0,
              movementType: delta > 0 ? 'ADJUSTMENT' : 'ADJUSTMENT',
              movementQty: delta,
              reason: 'bulk_import',
              userId: this.ctx.userId,
            });
          }
          if (row.lowStockThreshold !== undefined) {
            await tx.inventoryLevel.update({
              where: { tenantId_variantId: { tenantId, variantId: variant.id } },
              data: { lowStockThreshold: row.lowStockThreshold },
            });
          }
          succeeded++;
        }
        return { succeeded, failed };
      },
    );
  }

  // -------------------------------------------------------------------------
  // Event emission — low-stock / out-of-stock (idempotent per day)
  // -------------------------------------------------------------------------

  /**
   * Emit `inventory.out_of_stock` the moment on-hand hits 0, and
   * `inventory.low_stock` once per variant per calendar day. A
   * de-dupe outbox event per (tenant, variant, date) prevents storms.
   */
  private async emitThresholdEvents(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantId: string,
    level: {
      stockOnHand: number;
      stockReserved: number;
      lowStockThreshold: number;
      available?: number;
    },
  ): Promise<void> {
    const available = level.stockOnHand - level.stockReserved;

    if (available <= 0) {
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Inventory',
        aggregateId: variantId,
        eventType: 'inventory.out_of_stock',
        payload: {
          variantId,
          stockOnHand: level.stockOnHand,
          stockReserved: level.stockReserved,
          available,
        } as Prisma.InputJsonValue,
      });
      return;
    }

    if (available <= level.lowStockThreshold) {
      // Day-scoped de-dup: we search for an existing `inventory.low_stock`
      // row since midnight UTC for this aggregateId and skip if one is there.
      const midnight = new Date();
      midnight.setUTCHours(0, 0, 0, 0);
      const existing = await tx.outboxEvent.findFirst({
        where: {
          tenantId,
          aggregateType: 'Inventory',
          aggregateId: variantId,
          eventType: 'inventory.low_stock',
          createdAt: { gte: midnight },
        },
        select: { id: true },
      });
      if (existing) return;

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Inventory',
        aggregateId: variantId,
        eventType: 'inventory.low_stock',
        payload: {
          variantId,
          stockOnHand: level.stockOnHand,
          stockReserved: level.stockReserved,
          available,
          lowStockThreshold: level.lowStockThreshold,
        } as Prisma.InputJsonValue,
      });
    }
  }
}

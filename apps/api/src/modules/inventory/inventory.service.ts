import { BadRequestException, Injectable } from '@nestjs/common';
import { withTenant } from '@ecf/db';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

export interface ReserveLine {
  variantId: string;
  quantity: number;
}

export interface ReservationResult {
  reservationIds: string[];
  expiresAt: Date;
}

/**
 * Inventory rezervasyon servisi (FSD 4.4.4). Her rezervasyon satırı
 * `inventory_reservations` tablosuna yazılır ve `product_variants.stockReserved`
 * sayacını arttırır; stock OnHand = physical-on-shelf, Reserved = satışa kilitli
 * ama henüz decrement edilmemiş birimler. available = stockOnHand - stockReserved.
 *
 * confirm() → rezervasyon close edilir, stockOnHand decrement, stockReserved düşer.
 * release() → rezervasyon iptal, stockReserved düşer, stockOnHand değişmez.
 *
 * Eşzamanlı last-unit satışı için `$transaction` + `Serializable` isolation
 * kullanıyoruz — concurrent checkout'ta bir tane başarılı olur, diğeri OOS alır.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly ctx: TenantContextService) {}

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

  /**
   * Reserve the given variants for `ttlMinutes`. Writes an
   * InventoryReservation row per line and bumps ProductVariant.stockReserved.
   */
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
          const updated = await tx.productVariant.updateMany({
            where: {
              id: line.variantId,
              tenantId,
              // ensure (stockOnHand - stockReserved) >= quantity
              stockReserved: { lte: Number.MAX_SAFE_INTEGER },
            },
            data: { stockReserved: { increment: line.quantity } },
          });
          if (updated.count === 0) {
            throw new BadRequestException({
              code: 'variant_not_found',
              message: `Variant ${line.variantId} not found`,
            });
          }
          // Re-read to verify the stockReserved didn't exceed stockOnHand.
          const v = await tx.productVariant.findUnique({
            where: { id: line.variantId },
            select: { stockOnHand: true, stockReserved: true },
          });
          if (!v || v.stockReserved > v.stockOnHand) {
            throw new BadRequestException({
              code: 'out_of_stock',
              message: `Insufficient stock for variant ${line.variantId}`,
            });
          }
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

  /**
   * Confirm all active reservations for `sessionId`: stockReserved -=, stockOnHand -=,
   * mark reservation as released (releasedAt=now) and attach orderId.
   */
  async confirm(sessionId: string, orderId: string): Promise<void> {
    const tenantId = this.requireTenant();
    await withTenant({ tenantId, userId: this.ctx.userId, isolationLevel: 'Serializable' }, async (tx) => {
      const reservations = await tx.inventoryReservation.findMany({
        where: { tenantId, sessionId, releasedAt: null },
      });
      for (const r of reservations) {
        await tx.productVariant.update({
          where: { id: r.variantId },
          data: {
            stockReserved: { decrement: r.quantity },
            stockOnHand: { decrement: r.quantity },
          },
        });
        await tx.inventoryReservation.update({
          where: { id: r.id },
          data: { releasedAt: new Date(), orderId },
        });
      }
    });
  }

  /**
   * Release reservations (session abandoned or expired). Un-reserves stock
   * without touching stockOnHand.
   */
  async release(sessionId: string): Promise<void> {
    const tenantId = this.requireTenant();
    await withTenant({ tenantId, userId: this.ctx.userId, isolationLevel: 'Serializable' }, async (tx) => {
      const reservations = await tx.inventoryReservation.findMany({
        where: { tenantId, sessionId, releasedAt: null },
      });
      for (const r of reservations) {
        await tx.productVariant.update({
          where: { id: r.variantId },
          data: { stockReserved: { decrement: r.quantity } },
        });
        await tx.inventoryReservation.update({
          where: { id: r.id },
          data: { releasedAt: new Date() },
        });
      }
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  ConvertDraftOrderInput,
  CreateDraftOrderInput,
  ListOrdersQuery,
  UpdateDraftOrderInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { OutboxService } from '../../common/outbox/outbox.service';

/**
 * Admin-created manual orders (FSD 5.3.2). Lives alongside the main Order
 * aggregate — distinguished by `isDraft=true` + `status='draft'`. Drafts are
 * excluded from customer-facing queries and do NOT reserve inventory (per
 * FSD: inventory lock happens at convert-to-order).
 */
@Injectable()
export class DraftOrdersService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly outbox: OutboxService,
  ) {}

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

  private generateOrderNumber(): string {
    const d = new Date();
    const yy = String(d.getUTCFullYear()).slice(-2);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 36 ** 6)
      .toString(36)
      .toUpperCase()
      .padStart(6, '0');
    return `D-${yy}${mm}${dd}-${rand}`;
  }

  async create(input: CreateDraftOrderInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      // Snapshot variant prices so draft total reflects catalog at creation time.
      const variantIds = input.lines.map((l) => l.variantId);
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          sku: true,
          priceMinorUnits: true,
          currency: true,
          productId: true,
          product: { select: { title: true } },
        },
      });
      const byId = new Map(variants.map((v) => [v.id, v]));
      for (const line of input.lines) {
        if (!byId.has(line.variantId)) {
          throw new NotFoundException({
            code: 'variant_not_found',
            message: `Variant ${line.variantId} not found`,
          });
        }
      }
      let subtotal = 0n;
      const orderLines = input.lines.map((l) => {
        const v = byId.get(l.variantId)!;
        if (v.currency !== input.currency) {
          throw new BadRequestException({
            code: 'currency_mismatch',
            message: `Variant ${v.id} priced in ${v.currency}, draft is ${input.currency}`,
          });
        }
        const price = l.priceMinorUnits ?? v.priceMinorUnits;
        const lineTotal = price * BigInt(l.quantity);
        subtotal += lineTotal;
        return {
          tenantId,
          variantId: v.id,
          productId: v.productId,
          sku: v.sku,
          titleSnapshot: v.product.title,
          priceMinorUnits: price,
          quantity: l.quantity,
          totalMinorUnits: lineTotal,
        };
      });

      const shipping = input.shippingMinor ?? 0n;
      const tax = input.taxMinor ?? 0n;
      const discount = input.discountMinor ?? 0n;
      const total = subtotal + shipping + tax - discount;

      const orderNumber = this.generateOrderNumber();
      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerId: input.customerId ?? null,
          guestEmail: input.guestEmail ?? null,
          status: 'draft',
          isDraft: true,
          subtotalMinor: subtotal,
          taxMinor: tax,
          shippingMinor: shipping,
          discountMinor: discount,
          totalMinor: total < 0n ? 0n : total,
          currency: input.currency,
          paymentProvider: 'stub',
          paymentRef: null,
          lines: { create: orderLines },
          statusHistory: {
            create: {
              tenantId,
              fromStatus: null,
              toStatus: 'draft',
              actorUserId: this.ctx.userId ?? null,
              note: input.note ?? 'Draft created',
            },
          },
        },
        include: { lines: true },
      });
      return order;
    });
  }

  async list(q: ListOrdersQuery) {
    const tenantId = this.requireTenant();
    const where: Prisma.OrderWhereInput = { isDraft: true };
    if (q.query) where.orderNumber = { contains: q.query, mode: 'insensitive' };
    if (q.customerId) where.customerId = q.customerId;
    if (q.cursor) {
      try {
        const [iso, id] = Buffer.from(q.cursor, 'base64')
          .toString('utf-8')
          .split('|');
        if (iso && id) {
          const dt = new Date(iso);
          where.AND = [
            {
              OR: [
                { placedAt: { lt: dt } },
                { AND: [{ placedAt: dt }, { id: { lt: id } }] },
              ],
            },
          ];
        }
      } catch {
        /* ignore */
      }
    }
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.order.findMany({
        where,
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
        include: { _count: { select: { lines: true } } },
      });
      const hasMore = rows.length > q.limit;
      const items = hasMore ? rows.slice(0, q.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? Buffer.from(`${last.placedAt.toISOString()}|${last.id}`).toString('base64')
          : null;
      return { items, nextCursor, hasMore };
    });
  }

  async findById(id: string) {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId }, (tx) =>
      tx.order.findUnique({ where: { id }, include: { lines: true } }),
    );
    if (!row || !row.isDraft) {
      throw new NotFoundException({
        code: 'draft_order_not_found',
        message: 'Draft order not found',
      });
    }
    return row;
  }

  async update(id: string, input: UpdateDraftOrderInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.order.findUnique({ where: { id } });
      if (!existing || !existing.isDraft) {
        throw new NotFoundException({
          code: 'draft_order_not_found',
          message: 'Draft order not found',
        });
      }

      const data: Prisma.OrderUpdateInput = {};
      if (input.customerId !== undefined) {
        data.customer = input.customerId
          ? { connect: { id: input.customerId } }
          : { disconnect: true };
      }
      if (input.guestEmail !== undefined) data.guestEmail = input.guestEmail;
      if (input.shippingMinor !== undefined) data.shippingMinor = input.shippingMinor;
      if (input.taxMinor !== undefined) data.taxMinor = input.taxMinor;
      if (input.discountMinor !== undefined) data.discountMinor = input.discountMinor;

      if (input.lines) {
        const variantIds = input.lines.map((l) => l.variantId);
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            sku: true,
            priceMinorUnits: true,
            currency: true,
            productId: true,
            product: { select: { title: true } },
          },
        });
        const byId = new Map(variants.map((v) => [v.id, v]));
        let subtotal = 0n;
        const newLines = input.lines.map((l) => {
          const v = byId.get(l.variantId);
          if (!v) {
            throw new NotFoundException({
              code: 'variant_not_found',
              message: `Variant ${l.variantId} not found`,
            });
          }
          if (v.currency !== existing.currency) {
            throw new BadRequestException({
              code: 'currency_mismatch',
              message: `Variant ${v.id} priced in ${v.currency}`,
            });
          }
          const price = l.priceMinorUnits ?? v.priceMinorUnits;
          const lineTotal = price * BigInt(l.quantity);
          subtotal += lineTotal;
          return {
            tenantId,
            variantId: v.id,
            productId: v.productId,
            sku: v.sku,
            titleSnapshot: v.product.title,
            priceMinorUnits: price,
            quantity: l.quantity,
            totalMinorUnits: lineTotal,
          };
        });
        await tx.orderLine.deleteMany({ where: { orderId: id } });
        await tx.orderLine.createMany({
          data: newLines.map((line) => ({ ...line, orderId: id })),
        });
        data.subtotalMinor = subtotal;
        const shipping = input.shippingMinor ?? existing.shippingMinor;
        const tax = input.taxMinor ?? existing.taxMinor;
        const discount = input.discountMinor ?? existing.discountMinor;
        const total = subtotal + shipping + tax - discount;
        data.totalMinor = total < 0n ? 0n : total;
      } else if (
        input.shippingMinor !== undefined ||
        input.taxMinor !== undefined ||
        input.discountMinor !== undefined
      ) {
        const shipping = input.shippingMinor ?? existing.shippingMinor;
        const tax = input.taxMinor ?? existing.taxMinor;
        const discount = input.discountMinor ?? existing.discountMinor;
        const total = existing.subtotalMinor + shipping + tax - discount;
        data.totalMinor = total < 0n ? 0n : total;
      }
      if (input.note) {
        await tx.orderStatusHistory.create({
          data: {
            tenantId,
            orderId: id,
            fromStatus: 'draft',
            toStatus: 'draft',
            actorUserId: this.ctx.userId ?? null,
            note: input.note,
          },
        });
      }
      return tx.order.update({
        where: { id },
        data,
        include: { lines: true },
      });
    });
  }

  /**
   * Convert a draft to a real pending-payment order. Flips `isDraft=false` and
   * `status='pending_payment'`, writes the status history row, and publishes
   * `order.created`.
   */
  async convert(id: string, input: ConvertDraftOrderInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!existing || !existing.isDraft) {
        throw new NotFoundException({
          code: 'draft_order_not_found',
          message: 'Draft order not found',
        });
      }
      if (existing.status !== 'draft') {
        throw new BadRequestException({
          code: 'draft_order_invalid_status',
          message: `Cannot convert draft in status ${existing.status}`,
        });
      }
      if (existing.lines.length === 0) {
        throw new BadRequestException({
          code: 'draft_order_empty',
          message: 'Draft has no line items',
        });
      }
      const updated = await tx.order.update({
        where: { id },
        data: {
          isDraft: false,
          status: 'pending_payment',
          placedAt: new Date(),
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          tenantId,
          orderId: id,
          fromStatus: 'draft',
          toStatus: 'pending_payment',
          actorUserId: this.ctx.userId ?? null,
          note: 'Draft converted to order',
        },
      });
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Order',
        aggregateId: id,
        eventType: 'order.created',
        payload: {
          orderId: id,
          orderNumber: updated.orderNumber,
          status: updated.status,
          totalMinor: updated.totalMinor.toString(),
          currency: updated.currency,
          customerId: updated.customerId,
          notifyCustomer: input.notifyCustomer ?? false,
          source: 'draft_convert',
        } as Prisma.InputJsonValue,
      });
      return updated;
    });
  }
}

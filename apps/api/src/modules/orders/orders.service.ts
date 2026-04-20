import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrderStatus, Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  CancelOrderInput,
  CreateShipmentInput,
  ListOrdersQuery,
  RefundRequestInput,
  UpdateOrderStatusInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import { OrderStateMachine } from './order-state-machine';

interface CreateOrderLineInput {
  variantId: string;
  productId: string;
  sku: string;
  titleSnapshot: string;
  priceMinorUnits: bigint;
  quantity: number;
}

export interface CreateOrderInput {
  customerId: string | null;
  guestEmail: string | null;
  currency: string;
  subtotalMinor: bigint;
  shippingMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  paymentProvider: string;
  paymentRef: string | null;
  lines: CreateOrderLineInput[];
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly outbox: OutboxService,
  ) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) {
      throw new NotFoundException({ code: 'tenant_required', message: 'Tenant context required' });
    }
    return id;
  }

  // -------------------------------------------------------------------------
  // Creation (called from CheckoutService)
  // -------------------------------------------------------------------------

  /**
   * Create an Order aggregate + OrderLines + OrderStatusHistory + outbox events
   * all in one Prisma transaction. Called by CheckoutService.complete().
   * Status is set by the caller via `initialStatus` — usually `payment_success`
   * for stub_card (auto-succeed) or `pending_payment` for cod.
   */
  async create(
    input: CreateOrderInput,
    initialStatus: OrderStatus,
  ): Promise<{ id: string; orderNumber: string; status: OrderStatus }> {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const orderNumber = this.generateOrderNumber();
      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerId: input.customerId,
          guestEmail: input.guestEmail,
          status: initialStatus,
          subtotalMinor: input.subtotalMinor,
          taxMinor: input.taxMinor,
          shippingMinor: input.shippingMinor,
          discountMinor: input.discountMinor,
          totalMinor: input.totalMinor,
          currency: input.currency,
          paymentProvider: input.paymentProvider,
          paymentRef: input.paymentRef,
          paidAt: initialStatus === 'payment_success' ? new Date() : null,
          lines: {
            create: input.lines.map((line) => ({
              tenantId,
              variantId: line.variantId,
              productId: line.productId,
              sku: line.sku,
              titleSnapshot: line.titleSnapshot,
              priceMinorUnits: line.priceMinorUnits,
              quantity: line.quantity,
              totalMinorUnits: line.priceMinorUnits * BigInt(line.quantity),
            })),
          },
          statusHistory: {
            create: {
              tenantId,
              fromStatus: null,
              toStatus: initialStatus,
              actorUserId: this.ctx.userId ?? null,
              note: 'Order placed',
            },
          },
        },
        select: { id: true, orderNumber: true, status: true },
      });

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Order',
        aggregateId: order.id,
        eventType: 'order.created',
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalMinor: input.totalMinor.toString(),
          currency: input.currency,
          customerId: input.customerId,
        } as Prisma.InputJsonValue,
      });
      if (initialStatus === 'payment_success') {
        await this.outbox.publish(tx, {
          tenantId,
          aggregateType: 'Order',
          aggregateId: order.id,
          eventType: 'order.paid',
          payload: {
            orderId: order.id,
            totalMinor: input.totalMinor.toString(),
            paidAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        });
      }
      return order;
    });
  }

  /**
   * Human-facing order number. YYMMDD-XXXXXX where XXXXXX is a random base-36
   * slug. Uniqueness is enforced by `@@unique([tenantId, orderNumber])`; if a
   * collision ever occurs, Prisma will error and the transaction will retry.
   */
  private generateOrderNumber(): string {
    const d = new Date();
    const yy = String(d.getUTCFullYear()).slice(-2);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 36 ** 6)
      .toString(36)
      .toUpperCase()
      .padStart(6, '0');
    return `${yy}${mm}${dd}-${rand}`;
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(q: ListOrdersQuery) {
    const tenantId = this.requireTenant();
    const where: Prisma.OrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.query) where.orderNumber = { contains: q.query, mode: 'insensitive' };
    if (q.dateFrom || q.dateTo) {
      where.placedAt = {};
      if (q.dateFrom) (where.placedAt as Prisma.DateTimeFilter).gte = new Date(q.dateFrom);
      if (q.dateTo) (where.placedAt as Prisma.DateTimeFilter).lte = new Date(q.dateTo);
    }
    if (q.cursor) {
      try {
        const raw = Buffer.from(q.cursor, 'base64').toString('utf-8');
        const [iso, id] = raw.split('|');
        if (iso && id) {
          const dt = new Date(iso);
          where.AND = [
            { OR: [{ placedAt: { lt: dt } }, { AND: [{ placedAt: dt }, { id: { lt: id } }] }] },
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
      tx.order.findUnique({
        where: { id },
        include: {
          lines: true,
          statusHistory: { orderBy: { occurredAt: 'desc' } },
          customer: true,
        },
      }),
    );
    if (!row) throw new NotFoundException({ code: 'order_not_found', message: 'Order not found' });
    return row;
  }

  async listMine(q: ListOrdersQuery) {
    const rc = this.ctx.get();
    const tenantId = rc?.tenant?.tenantId;
    const customerId = rc?.customerId;
    if (!tenantId || !customerId) {
      throw new ForbiddenException({
        code: 'customer_auth_required',
        message: 'Customer authentication required',
      });
    }
    return this.list({ ...q, customerId });
  }

  async findMine(id: string) {
    const rc = this.ctx.get();
    const tenantId = rc?.tenant?.tenantId;
    const customerId = rc?.customerId;
    if (!tenantId || !customerId) {
      throw new ForbiddenException({
        code: 'customer_auth_required',
        message: 'Customer authentication required',
      });
    }
    const row = await withTenant({ tenantId }, (tx) =>
      tx.order.findUnique({
        where: { id },
        include: {
          lines: true,
          statusHistory: { orderBy: { occurredAt: 'desc' } },
        },
      }),
    );
    if (!row || row.customerId !== customerId) {
      throw new NotFoundException({ code: 'order_not_found', message: 'Order not found' });
    }
    return row;
  }

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  async updateStatus(id: string, input: UpdateOrderStatusInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new NotFoundException({ code: 'order_not_found', message: 'Order not found' });
      }
      OrderStateMachine.assertTransition(existing.status, input.to);
      return this.applyTransition(tx, id, existing.status, input.to, input.note ?? null);
    });
  }

  async cancel(id: string, input: CancelOrderInput, actor: 'admin' | 'customer') {
    const tenantId = this.requireTenant();
    const rc = this.ctx.get();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.order.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({ code: 'order_not_found', message: 'Order not found' });
      }
      if (actor === 'customer' && existing.customerId !== rc?.customerId) {
        throw new ForbiddenException({ code: 'not_owner', message: 'Not the order owner' });
      }
      // Only pending_payment / payment_success / preparing can be cancelled by
      // customer; admin path goes through the FSM below.
      if (actor === 'customer' && !['pending_payment', 'payment_success'].includes(existing.status)) {
        throw new BadRequestException({
          code: 'cancel_not_allowed',
          message: 'This order can no longer be cancelled by the customer',
        });
      }
      OrderStateMachine.assertTransition(existing.status, 'cancelled');
      return this.applyTransition(
        tx,
        id,
        existing.status,
        'cancelled',
        input.reason ?? null,
      );
    });
  }

  async requestRefund(id: string, input: RefundRequestInput) {
    const tenantId = this.requireTenant();
    const rc = this.ctx.get();
    const customerId = rc?.customerId;
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.order.findUnique({ where: { id } });
      if (!existing || existing.customerId !== customerId) {
        throw new NotFoundException({ code: 'order_not_found', message: 'Order not found' });
      }
      OrderStateMachine.assertTransition(existing.status, 'refund_requested');
      return this.applyTransition(
        tx,
        id,
        existing.status,
        'refund_requested',
        input.reason,
      );
    });
  }

  /**
   * Admin creates a shipment: transitions preparing → shipped AND attaches
   * tracking info to the statusHistory note. A dedicated Shipment table is
   * not in the MVP schema (YAGNI), so we encode carrier/tracking in the audit
   * note and the outbox event payload.
   */
  async createShipment(id: string, input: CreateShipmentInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.order.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({ code: 'order_not_found', message: 'Order not found' });
      }
      if (existing.status !== 'preparing') {
        throw new BadRequestException({
          code: 'shipment_not_allowed',
          message: `Cannot ship from status ${existing.status}`,
        });
      }
      OrderStateMachine.assertTransition(existing.status, 'shipped');
      const note = `Shipped via ${input.carrier} — tracking ${input.trackingNumber}${
        input.note ? ` — ${input.note}` : ''
      }`;
      return this.applyTransition(tx, id, existing.status, 'shipped', note, {
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Shared transition helper (writes Order + history + outbox events)
  // -------------------------------------------------------------------------

  private async applyTransition(
    tx: Prisma.TransactionClient,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    note: string | null,
    extraPayload: Record<string, unknown> = {},
  ) {
    const tenantId = this.requireTenant();
    const data: Prisma.OrderUpdateInput = { status: to };
    if (to === 'payment_success') data.paidAt = new Date();
    if (to === 'shipped') data.shippedAt = new Date();
    if (to === 'delivered') data.deliveredAt = new Date();
    if (to === 'cancelled') data.cancelledAt = new Date();

    const updated = await tx.order.update({
      where: { id: orderId },
      data,
      select: { id: true, orderNumber: true, status: true, tenantId: true },
    });
    await tx.orderStatusHistory.create({
      data: {
        tenantId,
        orderId,
        fromStatus: from,
        toStatus: to,
        actorUserId: this.ctx.userId ?? null,
        note,
      },
    });

    await this.outbox.publish(tx, {
      tenantId,
      aggregateType: 'Order',
      aggregateId: orderId,
      eventType: 'order.status_changed',
      payload: {
        orderId,
        from,
        to,
        actorUserId: this.ctx.userId ?? null,
        note,
        ...extraPayload,
      } as Prisma.InputJsonValue,
    });

    // Additional domain events for important terminal/side-effecting edges.
    if (to === 'cancelled') {
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Order',
        aggregateId: orderId,
        eventType: 'order.cancelled',
        payload: { orderId, reason: note } as Prisma.InputJsonValue,
      });
    }
    if (to === 'shipped') {
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Order',
        aggregateId: orderId,
        eventType: 'order.shipped',
        payload: { orderId, ...extraPayload } as Prisma.InputJsonValue,
      });
    }
    return updated;
  }
}

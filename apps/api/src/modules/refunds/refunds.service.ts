import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  ApproveRefundInput,
  ListRefundsQuery,
  RefundRequestInput,
  RejectRefundInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import { OrderStateMachine } from '../orders/order-state-machine';

/**
 * Refund workflow — FSD 5.3.4.
 *
 * Customer creates a RefundRequest against one of their orders.
 * Admin approves → creates Refund (status=stub_completed) + transitions order
 * to `refunded` (full) or `partial_refunded` (partial).
 * Admin rejects → RefundRequest.REJECTED + order stays where it was.
 *
 * Payment gateway is out of scope — `Refund.status` is hard-coded to
 * `stub_completed`.
 */
@Injectable()
export class RefundsService {
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

  // -------------------------------------------------------------------------
  // Customer entrypoint — create RefundRequest + move order to refund_requested
  // -------------------------------------------------------------------------

  async createRequest(orderId: string, input: RefundRequestInput) {
    const tenantId = this.requireTenant();
    const rc = this.ctx.get();
    const customerId = rc?.customerId ?? null;
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { lines: { select: { id: true, totalMinorUnits: true } } },
      });
      if (!order) {
        throw new NotFoundException({
          code: 'order_not_found',
          message: 'Order not found',
        });
      }
      if (customerId && order.customerId && order.customerId !== customerId) {
        throw new ForbiddenException({
          code: 'not_owner',
          message: 'Not the order owner',
        });
      }
      // Reject if there's already a non-terminal refund request for this order.
      const existingOpen = await tx.refundRequest.findFirst({
        where: {
          orderId,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });
      if (existingOpen) {
        throw new BadRequestException({
          code: 'refund_already_open',
          message: 'An open refund request already exists for this order',
        });
      }
      // Default: whole-order refund. If itemSelections provided we total those;
      // if requestedAmount provided we trust it (clamped to order total).
      let requested = input.requestedAmount;
      if (!requested && input.itemSelections && input.itemSelections.length > 0) {
        requested = input.itemSelections.reduce(
          (acc, sel) => acc + sel.amount,
          0n,
        );
      }
      if (!requested) requested = order.totalMinor;
      if (requested <= 0n) {
        throw new BadRequestException({
          code: 'refund_amount_invalid',
          message: 'Refund amount must be positive',
        });
      }
      if (requested > order.totalMinor) {
        throw new BadRequestException({
          code: 'refund_amount_exceeds_total',
          message: 'Refund amount exceeds order total',
        });
      }

      // If order is eligible for the refund_requested transition — do it.
      // When order is already refund_requested/partial_refunded that's fine —
      // we just append the RefundRequest without re-transitioning.
      const shouldTransition = order.status !== 'refund_requested' &&
        order.status !== 'partial_refunded' &&
        order.status !== 'refunded';
      if (shouldTransition) {
        OrderStateMachine.assertTransition(order.status, 'refund_requested');
      }

      const refundRequest = await tx.refundRequest.create({
        data: {
          tenantId,
          orderId,
          customerId: order.customerId,
          reason: input.reason,
          reasonCategory: input.reasonCategory ?? 'OTHER',
          requestedAmount: requested,
          status: 'PENDING',
          itemSelections: (input.itemSelections ?? []) as unknown as Prisma.InputJsonValue,
        },
      });

      if (shouldTransition) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'refund_requested' },
        });
        await tx.orderStatusHistory.create({
          data: {
            tenantId,
            orderId,
            fromStatus: order.status,
            toStatus: 'refund_requested',
            actorUserId: this.ctx.userId ?? null,
            note: `Refund requested: ${input.reason}`,
          },
        });
        await this.outbox.publish(tx, {
          tenantId,
          aggregateType: 'Order',
          aggregateId: orderId,
          eventType: 'order.status_changed',
          payload: {
            orderId,
            from: order.status,
            to: 'refund_requested',
          } as Prisma.InputJsonValue,
        });
      }

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'RefundRequest',
        aggregateId: refundRequest.id,
        eventType: 'refund.requested',
        payload: {
          refundRequestId: refundRequest.id,
          orderId,
          requestedAmount: requested.toString(),
          reasonCategory: refundRequest.reasonCategory,
        } as Prisma.InputJsonValue,
      });

      return refundRequest;
    });
  }

  // -------------------------------------------------------------------------
  // Admin reads
  // -------------------------------------------------------------------------

  async list(q: ListRefundsQuery) {
    const tenantId = this.requireTenant();
    const where: Prisma.RefundRequestWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.orderId) where.orderId = q.orderId;
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
                { createdAt: { lt: dt } },
                { AND: [{ createdAt: dt }, { id: { lt: id } }] },
              ],
            },
          ];
        }
      } catch {
        /* ignore */
      }
    }
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.refundRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
      });
      const hasMore = rows.length > q.limit;
      const items = hasMore ? rows.slice(0, q.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64')
          : null;
      return { items, nextCursor, hasMore };
    });
  }

  async findById(id: string) {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId }, (tx) =>
      tx.refundRequest.findUnique({
        where: { id },
        include: { refunds: true },
      }),
    );
    if (!row) {
      throw new NotFoundException({
        code: 'refund_request_not_found',
        message: 'Refund request not found',
      });
    }
    return row;
  }

  // -------------------------------------------------------------------------
  // Admin — approve / reject
  // -------------------------------------------------------------------------

  async approve(id: string, input: ApproveRefundInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const request = await tx.refundRequest.findUnique({ where: { id } });
      if (!request) {
        throw new NotFoundException({
          code: 'refund_request_not_found',
          message: 'Refund request not found',
        });
      }
      if (request.status !== 'PENDING') {
        throw new BadRequestException({
          code: 'refund_request_not_pending',
          message: `Cannot approve request in status ${request.status}`,
        });
      }
      const order = await tx.order.findUnique({ where: { id: request.orderId } });
      if (!order) {
        throw new NotFoundException({
          code: 'order_not_found',
          message: 'Order not found',
        });
      }
      const approvedAmount = input.approvedAmount ?? request.requestedAmount;
      if (approvedAmount <= 0n) {
        throw new BadRequestException({
          code: 'refund_amount_invalid',
          message: 'Approved amount must be positive',
        });
      }
      if (approvedAmount > order.totalMinor) {
        throw new BadRequestException({
          code: 'refund_amount_exceeds_total',
          message: 'Approved amount exceeds order total',
        });
      }

      // Target status:
      //   partial_refunded when partial=true OR approvedAmount < order.totalMinor
      //   refunded         otherwise
      const isPartial = input.partial || approvedAmount < order.totalMinor;
      const to = isPartial ? 'partial_refunded' : 'refunded';
      OrderStateMachine.assertTransition(order.status, to);

      // Write RefundRequest.APPROVED + Refund row + order transition + history + outbox
      const now = new Date();
      await tx.refundRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: this.ctx.userId ?? null,
          approvedAt: now,
        },
      });
      const refund = await tx.refund.create({
        data: {
          tenantId,
          orderId: request.orderId,
          refundRequestId: request.id,
          amount: approvedAmount,
          status: 'stub_completed',
          note: input.note ?? null,
          createdBy: this.ctx.userId ?? null,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: to },
      });
      await tx.orderStatusHistory.create({
        data: {
          tenantId,
          orderId: order.id,
          fromStatus: order.status,
          toStatus: to,
          actorUserId: this.ctx.userId ?? null,
          note: `Refund approved: ${approvedAmount.toString()} ${order.currency}${
            input.note ? ` — ${input.note}` : ''
          }`,
        },
      });
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Order',
        aggregateId: order.id,
        eventType: 'order.status_changed',
        payload: { orderId: order.id, from: order.status, to } as Prisma.InputJsonValue,
      });
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'RefundRequest',
        aggregateId: request.id,
        eventType: 'refund.approved',
        payload: {
          refundRequestId: request.id,
          refundId: refund.id,
          orderId: order.id,
          amount: approvedAmount.toString(),
          partial: isPartial,
        } as Prisma.InputJsonValue,
      });

      return { ...request, status: 'APPROVED' as const, refund };
    });
  }

  async reject(id: string, input: RejectRefundInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const request = await tx.refundRequest.findUnique({ where: { id } });
      if (!request) {
        throw new NotFoundException({
          code: 'refund_request_not_found',
          message: 'Refund request not found',
        });
      }
      if (request.status !== 'PENDING') {
        throw new BadRequestException({
          code: 'refund_request_not_pending',
          message: `Cannot reject request in status ${request.status}`,
        });
      }
      const order = await tx.order.findUnique({ where: { id: request.orderId } });
      if (!order) {
        throw new NotFoundException({
          code: 'order_not_found',
          message: 'Order not found',
        });
      }
      const updated = await tx.refundRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: input.rejectionReason,
        },
      });

      // If order is still refund_requested AND this was the only open request,
      // transition back to the nearest valid state (we can't un-transition, so
      // we leave the order at refund_requested — admin can cancel from there).

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'RefundRequest',
        aggregateId: request.id,
        eventType: 'refund.rejected',
        payload: {
          refundRequestId: request.id,
          orderId: order.id,
          rejectionReason: input.rejectionReason,
        } as Prisma.InputJsonValue,
      });
      return updated;
    });
  }
}

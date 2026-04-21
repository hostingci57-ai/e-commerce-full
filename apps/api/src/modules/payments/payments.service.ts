import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PaymentStatus } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  PaymentMethodConfigInput,
  UpdatePaymentMethodConfigInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { PaymentRegistryService } from '../../common/payment/payment-registry.service';
import { OutboxService } from '../../common/outbox/outbox.service';

/**
 * PaymentsService encapsulates:
 *   - tenant admin CRUD for PaymentMethodConfig rows (what shows up on checkout)
 *   - host-side Payment row lifecycle (init, capture, refund)
 *   - outbox events for payment status changes
 *
 * The domain logic for "what to do when a payment transitions states"
 * lives in OrdersService (state machine) — this service is intentionally
 * decoupled from order-status transitions.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly registry: PaymentRegistryService,
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

  // -------------------- Admin CRUD (PaymentMethodConfig) --------------------

  async listConfigs() {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.paymentMethodConfig.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      });
      return rows.map((row) => this.serializeConfig(row));
    });
  }

  async listAvailableForTenant(cartTotal?: bigint) {
    const tenantId = this.requireTenant();
    return this.registry.listAvailable(tenantId, cartTotal);
  }

  async upsertConfig(input: PaymentMethodConfigInput) {
    const tenantId = this.requireTenant();
    this.registry.require(input.providerCode); // throws if unknown
    return withTenant({ tenantId }, async (tx) => {
      const existing = await tx.paymentMethodConfig.findUnique({
        where: {
          tenantId_providerCode: { tenantId, providerCode: input.providerCode },
        },
      });
      const data = {
        displayName: input.displayName,
        description: input.description ?? null,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        minAmount: input.minAmount ?? null,
        maxAmount: input.maxAmount ?? null,
      };
      const row = existing
        ? await tx.paymentMethodConfig.update({
            where: {
              tenantId_providerCode: {
                tenantId,
                providerCode: input.providerCode,
              },
            },
            data,
          })
        : await tx.paymentMethodConfig.create({
            data: { tenantId, providerCode: input.providerCode, ...data },
          });
      return this.serializeConfig(row);
    });
  }

  async updateConfig(id: string, input: UpdatePaymentMethodConfigInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const existing = await tx.paymentMethodConfig.findUnique({
        where: { tenantId_id: { tenantId, id } },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'payment_method_not_found',
          message: 'Payment method config not found',
        });
      }
      const data: Prisma.PaymentMethodConfigUpdateInput = {};
      if (input.displayName !== undefined) data.displayName = input.displayName;
      if (input.description !== undefined) data.description = input.description;
      if (input.config !== undefined) data.config = input.config as Prisma.InputJsonValue;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
      if (input.minAmount !== undefined) data.minAmount = input.minAmount;
      if (input.maxAmount !== undefined) data.maxAmount = input.maxAmount;
      const updated = await tx.paymentMethodConfig.update({
        where: { tenantId_id: { tenantId, id } },
        data,
      });
      return this.serializeConfig(updated);
    });
  }

  async deleteConfig(id: string) {
    const tenantId = this.requireTenant();
    await withTenant({ tenantId }, async (tx) => {
      await tx.paymentMethodConfig.delete({
        where: { tenantId_id: { tenantId, id } },
      });
    });
    return { ok: true };
  }

  // -------------------- Payment lifecycle ----------------------------------

  /**
   * Create a Payment row and drive the provider's init() call.
   * Returns the created payment + the init result so the caller (checkout)
   * can decide how to transition the order.
   */
  async initForOrder(input: {
    tenantId: string;
    orderId: string;
    providerCode: string;
    amount: bigint;
    currency: string;
    customer: { id: string | null; email: string | null; fullName: string | null };
    returnUrl?: string | null;
  }) {
    const { provider, config } = await this.registry.requireAvailable(
      input.tenantId,
      input.providerCode,
    );

    return withTenant({ tenantId: input.tenantId }, async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: input.tenantId,
          orderId: input.orderId,
          providerCode: input.providerCode,
          amount: input.amount,
          currency: input.currency,
          status: 'PENDING' as PaymentStatus,
        },
      });

      const result = await provider.init({
        tenantId: input.tenantId,
        orderId: input.orderId,
        amount: input.amount,
        currency: input.currency,
        customer: input.customer,
        returnUrl: input.returnUrl ?? null,
        config,
      });

      const mapped = this.mapInitStatus(result.status);
      const updated = await tx.payment.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: payment.id } },
        data: {
          status: mapped,
          providerRef: result.providerRef ?? null,
          failureReason: result.failureReason ?? null,
        },
      });

      await this.outbox.publish(tx, {
        tenantId: input.tenantId,
        aggregateType: 'Payment',
        aggregateId: updated.id,
        eventType: 'payment.initialized',
        payload: {
          paymentId: updated.id,
          orderId: updated.orderId,
          providerCode: updated.providerCode,
          status: updated.status,
          amount: updated.amount.toString(),
          currency: updated.currency,
        } as Prisma.InputJsonValue,
      });

      return { payment: updated, initResult: result };
    });
  }

  /**
   * Admin flips a pending payment to CAPTURED. Calls the provider's
   * capture() if present; returns the updated Payment.
   */
  async capturePayment(paymentId: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { tenantId_id: { tenantId, id: paymentId } },
      });
      if (!payment) {
        throw new NotFoundException({
          code: 'payment_not_found',
          message: 'Payment not found',
        });
      }
      if (payment.status === 'CAPTURED') return payment;
      if (payment.status === 'FAILED' || payment.status === 'REFUNDED') {
        throw new BadRequestException({
          code: 'payment_invalid_state',
          message: `Cannot capture payment in status ${payment.status}`,
        });
      }

      const provider = this.registry.require(payment.providerCode);
      const result = await provider.capture?.({
        tenantId,
        paymentId,
        providerRef: payment.providerRef ?? null,
      });

      const mapped = this.mapInitStatus(result?.status ?? 'captured');
      const updated = await tx.payment.update({
        where: { tenantId_id: { tenantId, id: paymentId } },
        data: {
          status: mapped,
          providerRef: result?.providerRef ?? payment.providerRef,
        },
      });

      if (updated.status === 'CAPTURED') {
        await this.outbox.publish(tx, {
          tenantId,
          aggregateType: 'Payment',
          aggregateId: updated.id,
          eventType: 'payment.captured',
          payload: {
            paymentId: updated.id,
            orderId: updated.orderId,
            providerCode: updated.providerCode,
            amount: updated.amount.toString(),
          } as Prisma.InputJsonValue,
        });
      }
      return updated;
    });
  }

  async findByOrderId(orderId: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, (tx) =>
      tx.payment.findFirst({
        where: { tenantId, orderId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  // -------------------- Helpers --------------------------------------------

  private mapInitStatus(status: string): PaymentStatus {
    switch (status) {
      case 'captured':
        return 'CAPTURED';
      case 'failed':
        return 'FAILED';
      case 'pending':
      case 'requires_redirect':
      default:
        return 'PENDING';
    }
  }

  private serializeConfig(row: {
    id: string;
    providerCode: string;
    displayName: string;
    description: string | null;
    config: Prisma.JsonValue;
    isActive: boolean;
    sortOrder: number;
    minAmount: bigint | null;
    maxAmount: bigint | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      providerCode: row.providerCode,
      displayName: row.displayName,
      description: row.description,
      config: row.config,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      minAmount: row.minAmount !== null ? row.minAmount.toString() : null,
      maxAmount: row.maxAmount !== null ? row.maxAmount.toString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

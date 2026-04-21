import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PaymentInitInput,
  PaymentInitResult,
  PaymentProvider,
  PaymentRefundResult,
} from '../payment-provider.interface';

/**
 * Test / simulation card provider.
 *
 * Always succeeds immediately — used for demos and automated tests
 * until a real gateway (iyzico/Stripe/PayTR) is wired in. Real
 * gateways will replace this class while keeping the same interface
 * so the checkout path doesn't change.
 */
@Injectable()
export class StubCardPaymentProvider implements PaymentProvider {
  readonly code = 'stub_card';
  readonly displayName = 'Kredi Kartı (Simülasyon)';
  readonly isActive = true;

  async init(_input: PaymentInitInput): Promise<PaymentInitResult> {
    return {
      status: 'captured',
      providerRef: `stub_${randomUUID()}`,
    };
  }

  async capture(input: {
    tenantId: string;
    paymentId: string;
    providerRef?: string | null;
  }): Promise<PaymentInitResult> {
    return {
      paymentId: input.paymentId,
      status: 'captured',
      providerRef: input.providerRef ?? undefined,
    };
  }

  async refund(input: {
    tenantId: string;
    paymentId: string;
    providerRef?: string | null;
    amount: bigint;
  }): Promise<PaymentRefundResult> {
    return {
      refundId: `stub_refund_${randomUUID()}`,
      status: 'refunded',
      providerRef: input.providerRef ?? undefined,
    };
  }
}

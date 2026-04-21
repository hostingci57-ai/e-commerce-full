import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PaymentInitInput,
  PaymentInitResult,
  PaymentProvider,
  PaymentRefundResult,
} from '../payment-provider.interface';

/**
 * Manual payment — catch-all for offline methods the shop supports
 * but that don't warrant a dedicated provider (cheque, store credit,
 * on-site POS, etc.). Admin flips the payment to captured from the
 * order page, identical flow to bank_transfer.
 */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly code = 'manual';
  readonly displayName = 'Manuel Ödeme';
  readonly isActive = true;

  async init(_input: PaymentInitInput): Promise<PaymentInitResult> {
    return {
      status: 'pending',
      providerRef: `manual_${randomUUID()}`,
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
      refundId: `manual_refund_${randomUUID()}`,
      status: 'pending',
      providerRef: input.providerRef ?? undefined,
    };
  }
}

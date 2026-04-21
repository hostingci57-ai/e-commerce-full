import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PaymentInitInput,
  PaymentInitResult,
  PaymentProvider,
  PaymentRefundResult,
} from '../payment-provider.interface';

/**
 * Bank Transfer (Havale / EFT).
 *
 * init → status='pending'. The customer transfers to the configured
 * IBAN and the shop admin approves the payment from the order detail
 * page (`capture()`), which flips order.status → payment_success.
 *
 * Refunds require a manual bank operation; the method returns a
 * pending placeholder — the admin finalizes it from the refund UI.
 */
@Injectable()
export class BankTransferPaymentProvider implements PaymentProvider {
  readonly code = 'bank_transfer';
  readonly displayName = 'Banka Havalesi / EFT';
  readonly isActive = true;

  async init(_input: PaymentInitInput): Promise<PaymentInitResult> {
    return {
      status: 'pending',
      providerRef: `bt_${randomUUID()}`,
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
      refundId: `bt_refund_${randomUUID()}`,
      status: 'pending',
      providerRef: input.providerRef ?? undefined,
    };
  }
}

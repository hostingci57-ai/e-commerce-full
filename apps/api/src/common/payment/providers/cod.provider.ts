import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PaymentInitInput,
  PaymentInitResult,
  PaymentProvider,
} from '../payment-provider.interface';

/**
 * Cash on Delivery (Kapıda Ödeme).
 *
 * init → status='captured' semantically — the order is "paid" for
 * pipeline purposes (no external gateway, the money is collected
 * when the courier hands over the package). Real accounting
 * reconciliation is out of scope for MVP.
 */
@Injectable()
export class CodPaymentProvider implements PaymentProvider {
  readonly code = 'cod';
  readonly displayName = 'Kapıda Ödeme';
  readonly isActive = true;

  async init(_input: PaymentInitInput): Promise<PaymentInitResult> {
    return {
      status: 'captured',
      providerRef: `cod_${randomUUID()}`,
    };
  }

  async capture(input: {
    tenantId: string;
    paymentId: string;
    providerRef?: string | null;
  }): Promise<PaymentInitResult> {
    // COD is already captured at init; capture is a no-op for idempotency.
    return {
      paymentId: input.paymentId,
      status: 'captured',
      providerRef: input.providerRef ?? undefined,
    };
  }
}

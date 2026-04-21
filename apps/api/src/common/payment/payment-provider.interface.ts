/**
 * Payment provider abstraction.
 *
 * Providers are pluggable (COD, bank transfer, card gateways, etc.).
 * The platform registers a set of built-in providers; tenants enable
 * them and supply provider-specific config (IBAN for bank_transfer,
 * fee limits, etc.) via `PaymentMethodConfig` rows.
 *
 * Gateway integrations (iyzico, Stripe, PayTR, ...) can plug in later
 * by implementing this interface — nothing in the checkout flow
 * hard-codes a specific provider.
 */

export type PaymentInitStatus =
  | 'pending'
  | 'requires_redirect'
  | 'captured'
  | 'failed';

export interface PaymentInitInput {
  tenantId: string;
  orderId: string;
  amount: bigint;
  currency: string;
  customer: {
    id: string | null;
    email: string | null;
    fullName: string | null;
  };
  /**
   * URL the gateway should hit after a hosted-page / 3-DS flow.
   * Ignored by providers that complete inline (cod, stub_card).
   */
  returnUrl?: string | null;
  /** Tenant-configured provider config (IBAN, branch info, ...). */
  config?: Record<string, unknown>;
}

export interface PaymentInitResult {
  /** Host-side Payment row id (the caller persists it). */
  paymentId?: string;
  status: PaymentInitStatus;
  redirectUrl?: string;
  providerRef?: string;
  failureReason?: string;
}

export interface PaymentRefundResult {
  refundId: string;
  status: 'pending' | 'refunded' | 'partial_refunded' | 'failed';
  providerRef?: string;
}

export interface PaymentProvider {
  /** Machine code — 'cod', 'bank_transfer', 'stub_card', 'manual'. */
  readonly code: string;
  /** Human-facing fallback label (tenant can override via config). */
  readonly displayName: string;
  /** True if the provider can be activated by tenants. */
  readonly isActive: boolean;

  init(input: PaymentInitInput): Promise<PaymentInitResult>;
  capture?(input: {
    tenantId: string;
    paymentId: string;
    providerRef?: string | null;
  }): Promise<PaymentInitResult>;
  refund?(input: {
    tenantId: string;
    paymentId: string;
    providerRef?: string | null;
    amount: bigint;
  }): Promise<PaymentRefundResult>;
}

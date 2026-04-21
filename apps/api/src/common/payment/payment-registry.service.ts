import { Injectable, NotFoundException } from '@nestjs/common';
import { withTenant } from '@ecf/db';
import type { PaymentProvider } from './payment-provider.interface';
import { CodPaymentProvider } from './providers/cod.provider';
import { BankTransferPaymentProvider } from './providers/bank-transfer.provider';
import { StubCardPaymentProvider } from './providers/stub-card.provider';
import { ManualPaymentProvider } from './providers/manual.provider';

export interface AvailablePaymentMethod {
  providerCode: string;
  displayName: string;
  description: string | null;
  config: Record<string, unknown>;
  sortOrder: number;
  minAmount: string | null;
  maxAmount: string | null;
}

/**
 * Central lookup + policy layer for payment providers.
 *
 *  - Maintains the in-memory list of built-in providers.
 *  - Resolves `tenantId + providerCode` → provider + merged config.
 *  - Filters providers by `isActive` + tenant config when the storefront
 *    asks for the list of available methods for a cart.
 */
@Injectable()
export class PaymentRegistryService {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(
    cod: CodPaymentProvider,
    bankTransfer: BankTransferPaymentProvider,
    stubCard: StubCardPaymentProvider,
    manual: ManualPaymentProvider,
  ) {
    for (const p of [cod, bankTransfer, stubCard, manual]) {
      this.providers.set(p.code, p);
    }
  }

  /** Every provider the platform knows about (regardless of tenant state). */
  listBuiltIn(): Pick<PaymentProvider, 'code' | 'displayName' | 'isActive'>[] {
    return Array.from(this.providers.values()).map((p) => ({
      code: p.code,
      displayName: p.displayName,
      isActive: p.isActive,
    }));
  }

  require(providerCode: string): PaymentProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      throw new NotFoundException({
        code: 'payment_provider_unknown',
        message: `Payment provider '${providerCode}' is not registered`,
      });
    }
    return provider;
  }

  /**
   * List methods the tenant has turned on. Used by storefront checkout.
   * Falls back to a "minimum viable" list (COD + stub_card) when the
   * tenant hasn't configured anything yet, so first-time checkouts work.
   */
  async listAvailable(tenantId: string, cartTotal?: bigint): Promise<AvailablePaymentMethod[]> {
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.paymentMethodConfig.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      }),
    );

    if (rows.length === 0) {
      // Bootstrap defaults — tenant hasn't configured payment yet.
      return [
        {
          providerCode: 'cod',
          displayName: 'Kapıda Ödeme',
          description: null,
          config: {},
          sortOrder: 0,
          minAmount: null,
          maxAmount: null,
        },
        {
          providerCode: 'stub_card',
          displayName: 'Kredi Kartı (Simülasyon)',
          description: null,
          config: {},
          sortOrder: 1,
          minAmount: null,
          maxAmount: null,
        },
      ];
    }

    return rows
      .filter((row) => {
        if (!this.providers.has(row.providerCode)) return false;
        if (cartTotal !== undefined) {
          if (row.minAmount !== null && cartTotal < row.minAmount) return false;
          if (row.maxAmount !== null && cartTotal > row.maxAmount) return false;
        }
        return true;
      })
      .map((row) => ({
        providerCode: row.providerCode,
        displayName: row.displayName,
        description: row.description,
        config: (row.config ?? {}) as Record<string, unknown>,
        sortOrder: row.sortOrder,
        minAmount: row.minAmount !== null ? row.minAmount.toString() : null,
        maxAmount: row.maxAmount !== null ? row.maxAmount.toString() : null,
      }));
  }

  /**
   * Load a specific config row + check the provider is registered.
   * Throws NotFoundException when the tenant hasn't enabled it.
   */
  async requireAvailable(
    tenantId: string,
    providerCode: string,
  ): Promise<{
    provider: PaymentProvider;
    config: Record<string, unknown>;
    displayName: string;
  }> {
    const provider = this.require(providerCode);
    const row = await withTenant({ tenantId }, (tx) =>
      tx.paymentMethodConfig.findUnique({
        where: { tenantId_providerCode: { tenantId, providerCode } },
      }),
    );
    // Allow fallback defaults (COD + stub_card) even if no config row exists
    // so first-time checkouts still work before the shop finishes onboarding.
    if (!row) {
      if (providerCode === 'cod' || providerCode === 'stub_card') {
        return {
          provider,
          config: {},
          displayName: provider.displayName,
        };
      }
      throw new NotFoundException({
        code: 'payment_method_disabled',
        message: `Payment method '${providerCode}' is not enabled for this tenant`,
      });
    }
    if (!row.isActive) {
      throw new NotFoundException({
        code: 'payment_method_disabled',
        message: `Payment method '${providerCode}' is inactive`,
      });
    }
    return {
      provider,
      config: (row.config ?? {}) as Record<string, unknown>,
      displayName: row.displayName,
    };
  }
}

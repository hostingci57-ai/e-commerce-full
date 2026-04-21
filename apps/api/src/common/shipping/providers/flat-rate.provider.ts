import { Injectable } from '@nestjs/common';
import type {
  ShippingCreateInput,
  ShippingCreateResult,
  ShippingProvider,
  ShippingRate,
  ShippingRateInput,
} from '../shipping-provider.interface';

/**
 * Flat-rate shipping — one or more fixed prices keyed by code.
 *
 * The rates themselves live in `shipping_method_configs` (one row per
 * rate code) so the shop can tune prices + ETAs without a code deploy.
 * When the tenant hasn't configured any flat-rate row, we fall back to
 * a sensible default pair (standard / express) to keep demo checkout
 * working out of the box.
 */
@Injectable()
export class FlatRateShippingProvider implements ShippingProvider {
  readonly code = 'flat_rate';
  readonly displayName = 'Sabit Ücret Kargo';
  readonly isActive = true;

  async getRates(input: ShippingRateInput): Promise<ShippingRate[]> {
    const cfg = input.config ?? {};
    const entries = Array.isArray(cfg.rates)
      ? (cfg.rates as Array<{
          code?: string;
          name?: string;
          priceMinor?: string | number;
          estimatedDaysMin?: number;
          estimatedDaysMax?: number;
          description?: string;
        }>)
      : [];

    if (entries.length === 0) {
      return [
        {
          providerCode: this.code,
          code: 'standard',
          name: 'Standart Kargo',
          priceMinor: 5000n,
          currency: input.currency,
          estimatedDays: { min: 2, max: 4 },
        },
        {
          providerCode: this.code,
          code: 'express',
          name: 'Ekspres Kargo',
          priceMinor: 12000n,
          currency: input.currency,
          estimatedDays: { min: 1, max: 1 },
        },
      ];
    }

    return entries.map((e) => ({
      providerCode: this.code,
      code: e.code ?? 'standard',
      name: e.name ?? 'Standart Kargo',
      priceMinor: e.priceMinor !== undefined ? BigInt(e.priceMinor) : 5000n,
      currency: input.currency,
      estimatedDays:
        e.estimatedDaysMin !== undefined && e.estimatedDaysMax !== undefined
          ? { min: e.estimatedDaysMin, max: e.estimatedDaysMax }
          : null,
      description: e.description ?? null,
    }));
  }

  async createShipment(input: ShippingCreateInput): Promise<ShippingCreateResult> {
    return {
      providerCode: this.code,
      trackingNumber: input.trackingNumber ?? null,
      trackingUrl: null,
      status: input.trackingNumber ? 'SHIPPED' : 'PENDING',
    };
  }
}

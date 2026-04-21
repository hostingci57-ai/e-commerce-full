import { Injectable } from '@nestjs/common';
import type {
  ShippingCreateInput,
  ShippingCreateResult,
  ShippingProvider,
  ShippingRate,
  ShippingRateInput,
} from '../shipping-provider.interface';

/**
 * Free shipping when cart subtotal >= threshold.
 *
 * Returns a single rate with priceMinor=0 when eligible; otherwise
 * no rates (the storefront should fall back to another provider).
 * Threshold lives in config.threshold (minor units).
 */
@Injectable()
export class FreeShippingProvider implements ShippingProvider {
  readonly code = 'free_shipping';
  readonly displayName = 'Ücretsiz Kargo';
  readonly isActive = true;

  async getRates(input: ShippingRateInput): Promise<ShippingRate[]> {
    const cfg = input.config ?? {};
    const threshold =
      cfg.threshold !== undefined ? BigInt(cfg.threshold as string | number) : 0n;
    if (input.subtotalMinor < threshold) return [];
    return [
      {
        providerCode: this.code,
        code: 'free',
        name: (cfg.name as string | undefined) ?? 'Ücretsiz Kargo',
        priceMinor: 0n,
        currency: input.currency,
        estimatedDays:
          cfg.estimatedDaysMin !== undefined && cfg.estimatedDaysMax !== undefined
            ? {
                min: cfg.estimatedDaysMin as number,
                max: cfg.estimatedDaysMax as number,
              }
            : { min: 2, max: 4 },
        freeShippingApplied: true,
      },
    ];
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

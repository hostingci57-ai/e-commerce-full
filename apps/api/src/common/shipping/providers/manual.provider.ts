import { Injectable } from '@nestjs/common';
import type {
  ShippingCreateInput,
  ShippingCreateResult,
  ShippingProvider,
  ShippingRate,
  ShippingRateInput,
  ShippingTrackResult,
} from '../shipping-provider.interface';

/**
 * Manual shipping — admin enters carrier + tracking number by hand.
 *
 * Offers a single rate; the price + name are pulled from tenant config
 * (defaults to "Manuel Kargo" with 0 price) so shops that handle
 * deliveries themselves can still quote customers at checkout.
 *
 * trackShipment is a no-op — the shop owns tracking URLs externally.
 */
@Injectable()
export class ManualShippingProvider implements ShippingProvider {
  readonly code = 'manual';
  readonly displayName = 'Manuel Kargo';
  readonly isActive = true;

  async getRates(input: ShippingRateInput): Promise<ShippingRate[]> {
    const cfg = input.config ?? {};
    const price =
      cfg.priceMinor !== undefined ? BigInt(cfg.priceMinor as string | number) : 0n;
    return [
      {
        providerCode: this.code,
        code: (cfg.code as string | undefined) ?? 'manual',
        name: (cfg.name as string | undefined) ?? 'Manuel Kargo',
        priceMinor: price,
        currency: input.currency,
        estimatedDays:
          cfg.estimatedDaysMin !== undefined && cfg.estimatedDaysMax !== undefined
            ? {
                min: cfg.estimatedDaysMin as number,
                max: cfg.estimatedDaysMax as number,
              }
            : null,
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

  async trackShipment(_trackingNumber: string): Promise<ShippingTrackResult> {
    return { status: 'PENDING', events: [] };
  }
}

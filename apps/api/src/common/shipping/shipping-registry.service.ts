import { Injectable, NotFoundException } from '@nestjs/common';
import { withTenant } from '@ecf/db';
import type {
  ShippingProvider,
  ShippingRate,
  ShippingRateInput,
} from './shipping-provider.interface';
import { FlatRateShippingProvider } from './providers/flat-rate.provider';
import { FreeShippingProvider } from './providers/free-shipping.provider';
import { ManualShippingProvider } from './providers/manual.provider';

/**
 * Resolves the full list of shipping rates available to a tenant for a
 * given destination + cart. Iterates over each active
 * `shipping_method_configs` row and asks the matching provider for its
 * rate list, merging the results and deduplicating by (providerCode, code).
 */
@Injectable()
export class ShippingRegistryService {
  private readonly providers = new Map<string, ShippingProvider>();

  constructor(
    flatRate: FlatRateShippingProvider,
    freeShipping: FreeShippingProvider,
    manual: ManualShippingProvider,
  ) {
    for (const p of [flatRate, freeShipping, manual]) {
      this.providers.set(p.code, p);
    }
  }

  listBuiltIn(): Pick<ShippingProvider, 'code' | 'displayName' | 'isActive'>[] {
    return Array.from(this.providers.values()).map((p) => ({
      code: p.code,
      displayName: p.displayName,
      isActive: p.isActive,
    }));
  }

  require(providerCode: string): ShippingProvider {
    const p = this.providers.get(providerCode);
    if (!p) {
      throw new NotFoundException({
        code: 'shipping_provider_unknown',
        message: `Shipping provider '${providerCode}' is not registered`,
      });
    }
    return p;
  }

  async listAvailable(
    input: Omit<ShippingRateInput, 'config'>,
  ): Promise<ShippingRate[]> {
    const rows = await withTenant({ tenantId: input.tenantId }, (tx) =>
      tx.shippingMethodConfig.findMany({
        where: { tenantId: input.tenantId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      }),
    );

    // No config rows → fall back to a default flat-rate so checkout still works.
    if (rows.length === 0) {
      const flat = this.providers.get('flat_rate')!;
      return flat.getRates({ ...input, config: {} });
    }

    const seen = new Set<string>();
    const out: ShippingRate[] = [];

    for (const row of rows) {
      const provider = this.providers.get(row.providerCode);
      if (!provider) continue;
      const config: Record<string, unknown> = {
        ...(row.config as Record<string, unknown> | null ?? {}),
        code: row.code,
        name: row.displayName,
        estimatedDaysMin: row.estimatedDaysMin ?? undefined,
        estimatedDaysMax: row.estimatedDaysMax ?? undefined,
        threshold: row.freeShippingThreshold?.toString(),
      };
      const rates = await provider.getRates({ ...input, config });
      for (const rate of rates) {
        const key = `${rate.providerCode}:${rate.code}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(rate);
      }
    }
    return out;
  }

  async requireRate(
    tenantId: string,
    providerCode: string,
    rateCode: string,
    cart: {
      subtotalMinor: bigint;
      currency: string;
      destinationAddress: ShippingRateInput['destinationAddress'];
      packages?: ShippingRateInput['packages'];
    },
  ): Promise<ShippingRate> {
    const rates = await this.listAvailable({
      tenantId,
      destinationAddress: cart.destinationAddress,
      packages: cart.packages ?? [],
      subtotalMinor: cart.subtotalMinor,
      currency: cart.currency,
    });
    const match = rates.find(
      (r) => r.providerCode === providerCode && r.code === rateCode,
    );
    if (!match) {
      throw new NotFoundException({
        code: 'shipping_rate_unavailable',
        message: `Shipping rate '${providerCode}:${rateCode}' is not available`,
      });
    }
    return match;
  }
}

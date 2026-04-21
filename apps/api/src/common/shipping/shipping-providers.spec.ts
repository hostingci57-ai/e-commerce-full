import { describe, it, expect } from 'vitest';
import { FlatRateShippingProvider } from './providers/flat-rate.provider';
import { FreeShippingProvider } from './providers/free-shipping.provider';
import { ManualShippingProvider } from './providers/manual.provider';
import type { ShippingRateInput } from './shipping-provider.interface';

const destination = {
  line1: 'Test Sok. 1',
  city: 'Istanbul',
  postalCode: '34000',
  country: 'TR',
};

function buildInput(overrides: Partial<ShippingRateInput> = {}): ShippingRateInput {
  return {
    tenantId: '00000000-0000-0000-0000-000000000000',
    destinationAddress: destination,
    packages: [{ quantity: 1 }],
    subtotalMinor: 20_000n,
    currency: 'TRY',
    ...overrides,
  };
}

describe('Shipping providers', () => {
  describe('FlatRateShippingProvider', () => {
    const p = new FlatRateShippingProvider();

    it('returns default standard + express when no config', async () => {
      const rates = await p.getRates(buildInput());
      expect(rates).toHaveLength(2);
      expect(rates.map((r) => r.code).sort()).toEqual(['express', 'standard']);
    });

    it('honours configured rate list', async () => {
      const rates = await p.getRates(
        buildInput({
          config: {
            rates: [
              {
                code: 'economy',
                name: 'Ekonomi',
                priceMinor: 3000,
                estimatedDaysMin: 5,
                estimatedDaysMax: 7,
              },
            ],
          },
        }),
      );
      expect(rates).toHaveLength(1);
      expect(rates[0]?.code).toBe('economy');
      expect(rates[0]?.priceMinor).toBe(3000n);
    });
  });

  describe('FreeShippingProvider', () => {
    const p = new FreeShippingProvider();

    it('returns an empty list under threshold', async () => {
      const rates = await p.getRates(
        buildInput({ subtotalMinor: 10_000n, config: { threshold: 50_000 } }),
      );
      expect(rates).toEqual([]);
    });

    it('returns a zero-priced rate at/over threshold', async () => {
      const rates = await p.getRates(
        buildInput({ subtotalMinor: 60_000n, config: { threshold: 50_000 } }),
      );
      expect(rates).toHaveLength(1);
      expect(rates[0]?.priceMinor).toBe(0n);
      expect(rates[0]?.freeShippingApplied).toBe(true);
    });
  });

  describe('ManualShippingProvider', () => {
    const p = new ManualShippingProvider();

    it('returns a single rate with configured name', async () => {
      const rates = await p.getRates(
        buildInput({ config: { name: 'Elden teslim', priceMinor: 2500 } }),
      );
      expect(rates).toHaveLength(1);
      expect(rates[0]?.name).toBe('Elden teslim');
      expect(rates[0]?.priceMinor).toBe(2500n);
    });

    it('trackShipment is a no-op returning PENDING', async () => {
      const res = await p.trackShipment('TRACK-1');
      expect(res.status).toBe('PENDING');
      expect(res.events).toEqual([]);
    });
  });
});

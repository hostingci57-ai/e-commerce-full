/**
 * Coupons e2e — placeholder suite.
 *
 * SKIPPED until QA enables the e2e harness (Fastify boot + PG container with
 * RLS + seeded tenant). The coupon engine unit tests at
 * `src/modules/coupons/coupons.service.spec.ts` provide the core coverage.
 */
import { describe, it } from 'vitest';

describe.skip('coupons (e2e) — to be enabled by QA agent', () => {
  it('POST /v1/coupons creates a coupon and listing returns it', async () => {
    // admin POST /v1/coupons { code:'SAVE10', type:'PERCENT', value:1000 }
    // GET /v1/coupons → response.items[0].code === 'SAVE10'
  });

  it('POST /v1/cart/coupon applies the coupon and recomputes totals', async () => {
    // seed cart with 1 variant priced 10000 minor
    // POST /v1/cart/coupon { code: 'SAVE10' }
    // cart.totals.discountMinor === '1000' and totalMinor === '9000'
  });

  it('Checkout complete records a CouponRedemption + increments usageCount', async () => {
    // seed coupon with usageLimit=1, cart with coupon applied
    // POST /v1/checkout/:token/complete
    // DB: coupon_redemptions row exists, coupons.usage_count === 1
    // A second checkout with same code should receive 400 coupon_usage_limit_reached
  });
});

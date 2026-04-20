/**
 * Coupon engine unit tests. Exercises the pure `evaluate()` static against
 * hand-built coupon + cart value objects — no Prisma, no DB.
 */
import { describe, expect, it } from 'vitest';
import { CouponsService } from './coupons.service';
import type {
  CartForCoupon,
  CouponRow,
  CustomerContextForCoupon,
} from './coupons.types';

function baseCoupon(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    id: 'coupon-1',
    tenantId: 't1',
    code: 'SAVE10',
    type: 'PERCENT',
    value: 1000n, // 10%
    minimumAmount: null,
    maximumDiscount: null,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usageLimitPerCustomer: null,
    usageCount: 0,
    stackable: false,
    isActive: true,
    customerGroupIds: [],
    categoryIds: [],
    productIds: [],
    ...overrides,
  };
}

function baseCart(overrides: Partial<CartForCoupon> = {}): CartForCoupon {
  return {
    subtotalMinor: 10000n, // 100.00
    currency: 'TRY',
    items: [
      {
        variantId: 'v1',
        productId: 'p1',
        quantity: 1,
        priceMinor: '10000',
        categoryIds: ['c1'],
      },
    ],
    shippingMinor: 2000n,
    ...overrides,
  };
}

const noCustomer: CustomerContextForCoupon = { customerId: null };
const now = new Date('2026-04-20T12:00:00Z');

describe('CouponsService.evaluate — percent', () => {
  it('applies a 10% discount on the subtotal', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ type: 'PERCENT', value: 1000n }),
      baseCart({ subtotalMinor: 20000n }),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(true);
    expect(r.discountMinor).toBe(2000n);
  });

  it('caps percent discount at maximumDiscount', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ type: 'PERCENT', value: 5000n, maximumDiscount: 1000n }),
      baseCart({ subtotalMinor: 100000n }),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(true);
    expect(r.discountMinor).toBe(1000n);
  });
});

describe('CouponsService.evaluate — fixed / free shipping', () => {
  it('applies a fixed-amount discount in minor units', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ type: 'FIXED', value: 1500n }),
      baseCart({ subtotalMinor: 20000n }),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(true);
    expect(r.discountMinor).toBe(1500n);
  });

  it('clamps fixed discount to cart subtotal', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ type: 'FIXED', value: 99999n }),
      baseCart({ subtotalMinor: 500n }),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(true);
    expect(r.discountMinor).toBe(500n);
  });

  it('free-shipping returns current shippingMinor', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ type: 'FREE_SHIPPING', value: 0n }),
      baseCart({ shippingMinor: 2500n }),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(true);
    expect(r.discountMinor).toBe(2500n);
  });
});

describe('CouponsService.evaluate — gating', () => {
  it('rejects when inactive', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ isActive: false }),
      baseCart(),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_inactive');
  });

  it('rejects when expired', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ endsAt: new Date('2026-04-01T00:00:00Z') }),
      baseCart(),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_expired');
  });

  it('rejects when not yet started', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ startsAt: new Date('2026-05-01T00:00:00Z') }),
      baseCart(),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_not_yet_started');
  });

  it('rejects when global usage limit reached', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ usageLimit: 10, usageCount: 10 }),
      baseCart(),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_usage_limit_reached');
  });

  it('rejects when per-customer limit reached', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ usageLimitPerCustomer: 1 }),
      baseCart(),
      { customerId: 'cust-1' },
      { customerRedemptionCount: 1, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_customer_limit_reached');
  });

  it('rejects below minimum amount', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ minimumAmount: 50000n }),
      baseCart({ subtotalMinor: 1000n }),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_minimum_amount_not_met');
  });

  it('rejects when empty cart', () => {
    const r = CouponsService.evaluate(
      baseCoupon(),
      baseCart({ items: [], subtotalMinor: 0n }),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_cart_empty');
  });
});

describe('CouponsService.evaluate — scope filters', () => {
  it('accepts when category matches', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ categoryIds: ['c1'] }),
      baseCart(),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(true);
  });

  it('rejects when category mismatch', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ categoryIds: ['c-other'] }),
      baseCart(),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_category_scope_mismatch');
  });

  it('rejects when product scope mismatch', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ productIds: ['p-other'] }),
      baseCart(),
      noCustomer,
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_product_scope_mismatch');
  });

  it('rejects when customer group mismatch', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ customerGroupIds: ['vip'] }),
      baseCart(),
      { customerId: 'cust-1', customerGroupIds: ['regular'] },
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('coupon_customer_group_mismatch');
  });

  it('accepts when customer group matches', () => {
    const r = CouponsService.evaluate(
      baseCoupon({ customerGroupIds: ['vip'] }),
      baseCart(),
      { customerId: 'cust-1', customerGroupIds: ['vip'] },
      { customerRedemptionCount: 0, now },
    );
    expect(r.valid).toBe(true);
  });
});

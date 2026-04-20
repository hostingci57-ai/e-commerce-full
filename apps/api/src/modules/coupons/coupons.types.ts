/**
 * Coupon engine primitives. Keeps the service testable without a DB by
 * accepting plain value objects that mirror Redis cart state + Prisma rows.
 */

export interface CartLineForCoupon {
  variantId: string;
  productId: string;
  /** Categories the product belongs to — optional for tests that don't care about scope. */
  categoryIds?: string[];
  quantity: number;
  /** Unit price in minor units (string to survive JSON round-trips). */
  priceMinor: string | bigint;
}

export interface CartForCoupon {
  subtotalMinor: bigint;
  currency: string;
  items: CartLineForCoupon[];
  /** Minor units. When calculating FREE_SHIPPING we cap by this. */
  shippingMinor?: bigint;
}

export interface CustomerContextForCoupon {
  customerId: string | null;
  /** Ids of customer groups the customer belongs to. */
  customerGroupIds?: string[];
}

export interface CouponRow {
  id: string;
  tenantId: string;
  code: string;
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
  value: bigint;
  minimumAmount: bigint | null;
  maximumDiscount: bigint | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  stackable: boolean;
  isActive: boolean;
  customerGroupIds: string[];
  categoryIds: string[];
  productIds: string[];
}

export interface CouponValidationResult {
  valid: boolean;
  /**
   * Absolute discount in minor units the coupon would apply. Zero when invalid.
   * For FREE_SHIPPING the value equals cart.shippingMinor (or 0 if unknown yet).
   */
  discountMinor: bigint;
  /** Machine-readable rejection reason when valid=false. */
  reason?:
    | 'coupon_not_found'
    | 'coupon_inactive'
    | 'coupon_not_yet_started'
    | 'coupon_expired'
    | 'coupon_usage_limit_reached'
    | 'coupon_customer_limit_reached'
    | 'coupon_minimum_amount_not_met'
    | 'coupon_product_scope_mismatch'
    | 'coupon_category_scope_mismatch'
    | 'coupon_customer_group_mismatch'
    | 'coupon_currency_mismatch'
    | 'coupon_cart_empty';
  couponId?: string;
  couponType?: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
}

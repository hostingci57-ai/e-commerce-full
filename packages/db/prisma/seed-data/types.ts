/**
 * Shared types for demo-tenant seed specifications.
 */

export type OrderStatusSeed =
  | 'pending_payment'
  | 'payment_success'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'closed'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded';

export type BrandSeed = { slug: string; name: string };

export type CategorySeed = {
  slug: string;
  name: string;
  parent: string | null;
  position: number;
};

export type VariantSeed = {
  sku: string;
  priceMinorUnits: bigint;
  compareAtMinorUnits?: bigint;
  stockOnHand: number;
  optionValue?: string;
};

export type ProductSeed = {
  slug: string;
  title: string;
  description: string;
  brand: string | null;
  categorySlugs: string[];
  variants: VariantSeed[];
  optionName?: string;
  mediaSeed: string;
};

export type CustomerSeed = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  line1: string;
  region: string;
  postalCode: string;
};

export type OrderSeed = {
  orderNumber: string;
  customerEmail: string;
  status: OrderStatusSeed;
  lines: Array<{ sku: string; quantity: number }>;
  shippingMinor?: bigint;
  discountMinor?: bigint;
  couponCode?: string;
  /** Days in the past relative to the seed run. */
  daysAgo: number;
};

export type CouponSeed = {
  code: string;
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
  /** PERCENT: basis points (1000 = 10%). FIXED: minor units. FREE_SHIPPING: ignored. */
  value: number;
  minimumAmount: bigint | null;
  maximumDiscount: bigint | null;
  isActive: boolean;
  endsAt: null | 'yesterday' | Date;
};

export type StaffSeed = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleCode: string;
};

export type DemoTenantSpec = {
  subdomain: string;
  name: string;
  planCode: 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  currency: 'TRY';
  ownerEmail: string;
  ownerPassword: string;
  ownerFirstName: string;
  ownerLastName: string;
  staff: StaffSeed[];
  brands: readonly BrandSeed[];
  categories: readonly CategorySeed[];
  products: ProductSeed[];
  customers: CustomerSeed[];
  orders: OrderSeed[];
  coupons: CouponSeed[];
};

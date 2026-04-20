import type { CartLine } from '../cart/cart.types';
import type { PaymentMethod, ShippingMethod } from '@ecf/validation';

/** Frozen snapshot of the cart taken at /checkout/start. */
export interface CheckoutCartSnapshot {
  items: CartLine[];
  currency: string;
  subtotalMinor: string;
  discountMinor: string;
  /** Applied coupon code + resolved id — redeemed at complete(). */
  couponCode: string | null;
  couponId: string | null;
}

export interface CheckoutAddress {
  fullName: string;
  phone: string | null;
  email: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
}

export type CheckoutStep = 'address' | 'shipping' | 'payment' | 'ready' | 'completed';

export interface CheckoutShipping {
  method: ShippingMethod;
  priceMinor: string;
}

export interface CheckoutPayment {
  method: PaymentMethod;
  stubToken: string | null;
  providerRef: string | null;
  /** pending_stub | paid_stub — reflects the mock provider state. */
  status: 'pending_stub' | 'paid_stub';
}

export interface CheckoutSession {
  token: string;
  tenantId: string;
  /** Who opened the checkout: customer id or null (guest). */
  customerId: string | null;
  cartToken: string | null;
  cart: CheckoutCartSnapshot;
  step: CheckoutStep;
  shippingAddress: CheckoutAddress | null;
  billingAddress: CheckoutAddress | null;
  shipping: CheckoutShipping | null;
  payment: CheckoutPayment | null;
  orderId: string | null;
  reservationIds: string[];
  reservationExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

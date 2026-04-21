/**
 * Shipping provider abstraction.
 *
 * Built-in providers cover flat-rate, free-shipping-over-threshold and
 * "manual" (admin enters tracking #). Real carrier integrations
 * (Yurtiçi, Aras, MNG, DHL, ...) plug in by implementing this interface
 * without changing checkout flow.
 */

export interface ShippingAddressLike {
  fullName?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
}

export interface ShippingPackage {
  weightGrams?: number;
  quantity: number;
  variantId?: string;
}

export interface ShippingRate {
  /** Method code (e.g. 'standard', 'express', 'free'). */
  code: string;
  /** Provider that owns this rate (matches PaymentProvider.code semantics). */
  providerCode: string;
  name: string;
  /** Price in minor units (kuruş). */
  priceMinor: bigint;
  currency: string;
  estimatedDays?: { min: number; max: number } | null;
  description?: string | null;
  freeShippingApplied?: boolean;
}

export interface ShippingRateInput {
  tenantId: string;
  originAddress?: ShippingAddressLike | null;
  destinationAddress: ShippingAddressLike;
  packages: ShippingPackage[];
  /** Cart subtotal in minor units — used by free-shipping provider. */
  subtotalMinor: bigint;
  currency: string;
  config?: Record<string, unknown>;
}

export interface ShippingCreateInput {
  tenantId: string;
  orderId: string;
  rateCode?: string;
  trackingNumber?: string | null;
  config?: Record<string, unknown>;
}

export interface ShippingCreateResult {
  providerCode: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  status: 'PENDING' | 'LABEL_CREATED' | 'SHIPPED';
  labelUrl?: string | null;
}

export interface ShippingTrackResult {
  status: 'PENDING' | 'LABEL_CREATED' | 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED';
  events: { at: string; label: string }[];
}

export interface ShippingProvider {
  readonly code: string;
  readonly displayName: string;
  readonly isActive: boolean;

  getRates(input: ShippingRateInput): Promise<ShippingRate[]>;
  createShipment?(input: ShippingCreateInput): Promise<ShippingCreateResult>;
  trackShipment?(trackingNumber: string): Promise<ShippingTrackResult>;
}

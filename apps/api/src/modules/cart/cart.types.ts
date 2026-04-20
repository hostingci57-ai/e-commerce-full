/**
 * Redis-resident cart aggregate. Cart is NOT a DB table in this system —
 * see FSD 4.4 + ADR-007. Totals are recomputed on read (pure function of
 * items + coupons) so we never persist stale money.
 */
export interface CartLine {
  /** Stable UUID of ProductVariant. */
  variantId: string;
  productId: string;
  sku: string;
  title: string;
  currency: string;
  /**
   * Unit price snapshot captured at add-time (minor units). Stored as string
   * because Redis is text and we need BigInt fidelity round-tripping the JSON.
   */
  priceMinor: string;
  quantity: number;
  addedAt: string; // ISO
}

export interface CartCoupon {
  code: string;
  /** Minor units of discount — negative is NOT allowed. */
  discountMinor: string;
  appliedAt: string;
}

export interface CartState {
  /** Owner token — cookie value for guests, `c:{customerId}` for members. */
  ownerKey: string;
  /** Unique cart id (UUID) used for logging / abandoned-cart emails. */
  cartId: string;
  customerId: string | null;
  tenantId: string;
  items: CartLine[];
  coupons: CartCoupon[];
  currency: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface CartTotals {
  subtotalMinor: bigint;
  discountMinor: bigint;
  totalMinor: bigint;
  itemCount: number;
  currency: string | null;
}

export interface CartView extends CartState {
  totals: CartTotals;
}

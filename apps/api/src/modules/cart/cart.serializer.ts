import type { CartView } from './cart.types';

/**
 * Response shape for cart endpoints. We serialise BigInt money to string to
 * survive JSON without losing precision — the BigIntSerializerInterceptor
 * handles BigInt values at the global level, but cart totals arrive here as
 * raw bigint, so we force them through `String()` explicitly.
 */
export function serializeCart(view: CartView) {
  return {
    cartId: view.cartId,
    tenantId: view.tenantId,
    customerId: view.customerId,
    currency: view.currency,
    items: view.items.map((i) => ({
      variantId: i.variantId,
      productId: i.productId,
      sku: i.sku,
      title: i.title,
      currency: i.currency,
      priceMinor: i.priceMinor,
      quantity: i.quantity,
      lineTotalMinor: (BigInt(i.priceMinor) * BigInt(i.quantity)).toString(),
      addedAt: i.addedAt,
    })),
    coupons: view.coupons,
    totals: {
      subtotalMinor: view.totals.subtotalMinor.toString(),
      discountMinor: view.totals.discountMinor.toString(),
      totalMinor: view.totals.totalMinor.toString(),
      itemCount: view.totals.itemCount,
      currency: view.totals.currency,
    },
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

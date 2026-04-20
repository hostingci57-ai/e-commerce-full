/**
 * Cart e2e — placeholder suite.
 *
 * SKIPPED until QA enables the e2e harness (Fastify boot + Redis container +
 * seeded tenant/variants). These assertions document the contract.
 *
 * Run: `pnpm --filter @ecf/api test` (once enabled).
 */
import { describe, it } from 'vitest';

describe.skip('cart (e2e) — to be enabled by QA agent', () => {
  it('POST /v1/cart/items adds a variant and returns cart with totals', async () => {
    // send POST /v1/cart/items { variantId, quantity }
    // expect 200 + cart with one line + subtotal = price*qty
    // response should set a cart_token cookie on first hit
  });

  it('PATCH /v1/cart/items/:variantId updates the quantity', async () => {
    // pre-seed cart with variant V qty 1
    // PATCH /v1/cart/items/V { quantity: 3 }
    // expect 200 + line.quantity === 3, totals updated
  });

  it('DELETE /v1/cart/items/:variantId removes the line and recomputes totals', async () => {
    // pre-seed cart with variant V qty 2
    // DELETE /v1/cart/items/V
    // expect cart with no items, subtotal 0
  });
});

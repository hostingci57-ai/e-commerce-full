/**
 * Cross-tenant leak e2e scaffold.
 *
 * These tests codify the primary security invariant of the platform: a tenant
 * MUST never read or mutate another tenant's rows, regardless of how the
 * request is crafted (JWT audience, manipulated headers, shared email, etc.).
 *
 * Scenarios are `describe.skip` until the QA agent wires the Fastify test
 * harness, a fresh PG database, Redis, and seed helpers.
 *
 * Run: `pnpm --filter @ecf/api test` (once enabled).
 */
import { describe, it } from 'vitest';

describe.skip('cross-tenant isolation (e2e) — RLS invariant [enabled by QA]', () => {
  it('product list returns an empty array when queried with the other tenant JWT', async () => {
    // 1. Create tenants A (slug "alpha") and B (slug "beta") with owner users.
    // 2. Create a product under tenant A.
    // 3. Call GET /v1/products with tenant B's staff access token.
    // 4. Expect 200 and an empty array; tenant A product MUST NOT appear.
  });

  it('order GET by id returns 404 when requested by the other tenant JWT', async () => {
    // 1. Create an order under tenant A (via checkout seed).
    // 2. Call GET /v1/orders/{orderId} with tenant B's staff token.
    // 3. Expect 404 (not 403) so the endpoint does not leak order existence.
  });

  it('customer email is scoped per tenant (same email, two distinct rows)', async () => {
    // 1. Register customer shopper@example.com on tenant A — receive customerId_A.
    // 2. Register customer shopper@example.com on tenant B — receive customerId_B.
    // 3. Expect customerId_A !== customerId_B and each row tenantId-scoped.
    // 4. The shared User record (if any) is landlord-scoped and re-used.
  });

  it('variant PATCH with tenant B JWT on tenant A variant returns 404', async () => {
    // 1. Seed variant V under tenant A.
    // 2. PATCH /v1/products/.../variants/V with tenant B staff JWT.
    // 3. Expect 404 — no data leak, no 403 (existence revealed).
  });

  it('cart fetched with tenant B subdomain on tenant A cart_token returns new empty cart', async () => {
    // 1. As tenant A guest, POST /v1/cart/items (sets cart_token cookie).
    // 2. Replay the same cart_token but on tenant B's subdomain (Host header).
    // 3. Expect a fresh empty cart — never tenant A items.
  });

  it('landlord endpoints reject staff JWT with 403', async () => {
    // 1. Acquire a staff JWT for tenant A.
    // 2. GET /v1/landlord/tenants with that token.
    // 3. Expect 403 landlord_only; no tenant list returned.
  });

  it('direct SQL proves RLS blocks cross-tenant SELECT under app role', async () => {
    // 1. As postgres, insert product rows for tenant A and tenant B.
    // 2. `SET app.current_tenant_id = '<A>'; SELECT count(*) FROM products;` → only A's rows.
    // 3. Same query with B's id shows only B's rows. Without SET → 0 rows.
  });

  it('outbox events are tenant-scoped and unreadable across tenants', async () => {
    // 1. Trigger an order-created event under tenant A.
    // 2. As tenant B, query outbox_events — must not surface tenant A's event.
  });
});

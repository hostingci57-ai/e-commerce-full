/**
 * Products e2e — placeholder suite.
 *
 * These tests are SKIPPED because the e2e test harness (boot Fastify against
 * TEST_DATABASE_URL, seed a tenant + staff user + JWT, apply migrations) has
 * not yet been wired in this phase. The QA agent is expected to flesh this
 * out. The assertions below encode the contract we want them to meet.
 *
 * Run: `pnpm --filter @ecf/api test` (once enabled).
 */
import { describe, it } from 'vitest';

describe.skip('products (e2e) — to be enabled by QA agent', () => {
  it('POST /v1/products creates a product with variant and emits outbox event', async () => {
    // seed tenant A, staff user with PRODUCT_MANAGER role
    // POST /v1/products with { slug, title, variant: {...} }
    // expect 201, response has id + variants[0]
    // expect outbox_events row with eventType='product.created'
  });

  it('GET /v1/products lists only current tenant products (cursor pagination)', async () => {
    // seed 25 products
    // GET /v1/products?limit=10
    // expect 10 items + nextCursor
    // GET /v1/products?limit=10&cursor=<nextCursor> → next 10
  });

  it('GET /v1/products/:id returns 404 for product in another tenant', async () => {
    // seed tenant A with product P
    // log in as staff of tenant B
    // GET /v1/products/:P.id with tenant B headers
    // expect 404
  });

  it('PATCH /v1/products/:id updates slug + emits product.updated event', async () => {
    // seed product
    // PATCH with { slug: 'new-slug' }
    // expect 200; outbox row with eventType='product.updated'
    // second PATCH with the same slug on a different product → 409 product_slug_taken
  });

  it('DELETE /v1/products/:id archives (soft delete) and emits product.deleted event', async () => {
    // DELETE → 200 { status: 'archived' }
    // GET list with status=archived → finds it
    // expect outbox row with eventType='product.deleted'
  });

  it('cross-tenant leak test: tenant A cannot see tenant B products even with raw ID', async () => {
    // seed product P in tenant B
    // auth as tenant A staff → GET /v1/products → P not in list
    // GET /v1/products/:P.id → 404 (RLS filters the row invisibly)
    // PATCH /v1/products/:P.id → 404
  });
});

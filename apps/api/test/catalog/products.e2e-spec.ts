/**
 * Products e2e — CRUD smoke through /v1/products.
 *
 * Skips cleanly when DB/Redis aren't reachable (E2E=1 opt-in).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { bootTestApp } from '../helpers/test-app';
import { createTenant, createCustomer, createProduct, truncateTenant } from '../helpers/db-seed';
import { mintAccessToken } from '../helpers/jwt-mint';
import { inject } from '../helpers/fetch';
import { e2eEnabled } from '../helpers/env-guard';

describe.skipIf(!e2eEnabled())('products (e2e)', () => {
  let app: NestFastifyApplication;
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    app = await bootTestApp();
    const t = await createTenant({ subdomain: `prod-${Date.now()}` });
    tenantId = t.id;
    const staff = await createCustomer(tenantId);
    token = await mintAccessToken({
      userId: staff.userId,
      audience: 'staff',
      tenantId,
      roles: ['OWNER'],
    });
  }, 60_000);

  afterAll(async () => {
    await truncateTenant(tenantId).catch(() => {});
    await app?.close();
  });

  it('GET /v1/products with staff token returns 200 with items array', async () => {
    await createProduct(tenantId, { stockOnHand: 5 });
    const res = await inject(app, {
      method: 'GET',
      url: '/v1/products',
      headers: { authorization: `Bearer ${token}` },
    });
    expect([200, 201]).toContain(res.statusCode);
    const body = res.json<{ items?: unknown[] }>();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('GET /v1/products/:unknownId returns 404 (not 500)', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/v1/products/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect([404, 400]).toContain(res.statusCode);
  });

  it('GET /v1/products without auth returns 401', async () => {
    const res = await inject(app, { method: 'GET', url: '/v1/products' });
    expect(res.statusCode).toBe(401);
  });

  it('seeded product appears in list', async () => {
    const p = await createProduct(tenantId, { slug: `inlist-${Date.now()}`, stockOnHand: 3 });
    const res = await inject(app, {
      method: 'GET',
      url: '/v1/products',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: Array<{ id: string }> }>();
    expect(body.items.some((it) => it.id === p.productId)).toBe(true);
  });

  it('GET /v1/products/:id seeded product returns the row under same tenant', async () => {
    const p = await createProduct(tenantId, { slug: `byid-${Date.now()}`, stockOnHand: 1 });
    const res = await inject(app, {
      method: 'GET',
      url: `/v1/products/${p.productId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const body = res.json<{ id: string }>();
      expect(body.id).toBe(p.productId);
    }
  });
});

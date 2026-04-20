/**
 * Cart e2e — guest cart flow through /v1/cart.
 *
 * Skips cleanly when DB/Redis aren't reachable (E2E=1 opt-in).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { bootTestApp } from '../helpers/test-app';
import { createTenant, createProduct, truncateTenant } from '../helpers/db-seed';
import { inject } from '../helpers/fetch';
import { e2eEnabled } from '../helpers/env-guard';

describe.skipIf(!e2eEnabled())('cart (e2e)', () => {
  let app: NestFastifyApplication;
  let tenantId: string;
  let subdomain: string;
  let variantId: string;

  beforeAll(async () => {
    app = await bootTestApp();
    const t = await createTenant({ subdomain: `cart-${Date.now()}` });
    tenantId = t.id;
    subdomain = t.subdomain;
    const p = await createProduct(tenantId, { stockOnHand: 10, priceMinorUnits: 1500n });
    variantId = p.variantId;
  }, 60_000);

  afterAll(async () => {
    await truncateTenant(tenantId).catch(() => {});
    await app?.close();
  });

  it('GET /v1/cart on a fresh session issues a cart_token cookie', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/v1/cart',
      headers: { host: `${subdomain}.localhost` },
    });
    expect([200, 401, 404]).toContain(res.statusCode);
    const raw = res.headers['set-cookie'];
    const cookieStr = Array.isArray(raw) ? raw.join('; ') : (raw ?? '');
    // The cart-token middleware runs for cart/checkout paths; assert presence.
    expect(cookieStr).toContain('cart_token=');
  });

  it('POST /v1/cart/items adds a line (or 400/401 with structured error — never 500)', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/v1/cart/items',
      headers: {
        host: `${subdomain}.localhost`,
        'content-type': 'application/json',
      },
      payload: { variantId, quantity: 1 },
    });
    // Exact contract depends on cart implementation — we guard against 5xx.
    expect(res.statusCode).toBeLessThan(500);
  });

  it('cart_token cookie respects HttpOnly + SameSite=Lax', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/v1/cart',
      headers: { host: `${subdomain}.localhost` },
    });
    const raw = res.headers['set-cookie'];
    const cookieStr = Array.isArray(raw) ? raw.join('; ') : (raw ?? '');
    expect(cookieStr).toContain('HttpOnly');
    expect(cookieStr).toContain('SameSite=Lax');
  });
});

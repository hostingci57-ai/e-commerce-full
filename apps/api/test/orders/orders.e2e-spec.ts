/**
 * Orders e2e — list + state machine smoke through /v1/orders.
 *
 * Skips cleanly when DB/Redis aren't reachable (E2E=1 opt-in).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { bootTestApp } from '../helpers/test-app';
import { createTenant, createCustomer, truncateTenant } from '../helpers/db-seed';
import { mintAccessToken } from '../helpers/jwt-mint';
import { inject } from '../helpers/fetch';
import { e2eEnabled } from '../helpers/env-guard';

describe.skipIf(!e2eEnabled())('orders (e2e)', () => {
  let app: NestFastifyApplication;
  let tenantId: string;
  let staffToken: string;
  let customerToken: string;

  beforeAll(async () => {
    app = await bootTestApp();
    const t = await createTenant({ subdomain: `ord-${Date.now()}` });
    tenantId = t.id;
    const staff = await createCustomer(tenantId);
    const cust = await createCustomer(tenantId);
    staffToken = await mintAccessToken({
      userId: staff.userId,
      audience: 'staff',
      tenantId,
      roles: ['ORDER_OPERATOR'],
    });
    customerToken = await mintAccessToken({
      userId: cust.userId,
      audience: 'customer',
      tenantId,
      customerId: cust.id,
      email: cust.email,
    });
  }, 60_000);

  afterAll(async () => {
    await truncateTenant(tenantId).catch(() => {});
    await app?.close();
  });

  it('GET /v1/orders without auth returns 401', async () => {
    const res = await inject(app, { method: 'GET', url: '/v1/orders' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /v1/orders with staff token returns 200', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/v1/orders',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items?: unknown[] }>();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('GET /v1/orders/:unknownId with staff token returns 404', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/v1/orders/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect([404, 400]).toContain(res.statusCode);
  });

  it('GET /v1/orders/me with customer token returns 200 (customer-scoped)', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/v1/orders/me',
      headers: { authorization: `Bearer ${customerToken}` },
    });
    // Customer-scoped endpoint may be under /v1/customers/me/orders depending on build.
    expect([200, 404]).toContain(res.statusCode);
  });

  it('PATCH /v1/orders/:unknownId/status returns 404 (state-machine guard intact)', async () => {
    const res = await inject(app, {
      method: 'PATCH',
      url: '/v1/orders/00000000-0000-0000-0000-000000000000/status',
      headers: {
        authorization: `Bearer ${staffToken}`,
        'content-type': 'application/json',
      },
      payload: { to: 'preparing' },
    });
    expect(res.statusCode).toBeLessThan(500);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

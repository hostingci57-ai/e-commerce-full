/**
 * LowStockSchedulerService tests. Verifies:
 *   - daily run skips tenants with no low-stock rows (no email, no outbox)
 *   - tenants with low stock get one email per distinct staff recipient +
 *     a single `inventory.low_stock_digest` outbox event
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ecf/db', () => ({
  withTenant: vi.fn(async (_: unknown, cb: (tx: unknown) => unknown) =>
    cb((globalThis as { __lowTx?: unknown }).__lowTx),
  ),
  // The service file indirectly imports `PRISMA` / `PRISMA_LANDLORD` providers
  // via the module graph, which reaches prisma.module.ts → `prisma` /
  // `prismaLandlord`. Provide benign stand-ins so the import graph resolves.
  prisma: {},
  prismaLandlord: {},
  Prisma: {},
}));

import { LowStockSchedulerService } from './low-stock-scheduler.service';

function makeLandlord(
  tenants: Array<{ id: string; name: string; subdomain: string }>,
  members: Record<string, Array<{ email: string; firstName: string | null }>>,
) {
  return {
    tenant: {
      findMany: vi.fn(async () => tenants),
    },
    tenantMember: {
      findMany: vi.fn(async ({ where }: { where: { tenantId: string } }) =>
        (members[where.tenantId] ?? []).map((u) => ({
          user: u,
        })),
      ),
    },
  };
}

describe('LowStockSchedulerService.run', () => {
  it('skips tenants with no low-stock rows and sends no email', async () => {
    (globalThis as { __lowTx?: unknown }).__lowTx = {
      $queryRaw: vi.fn(async () => [] as unknown[]),
    };
    const landlord = makeLandlord(
      [{ id: 't1', name: 'T1', subdomain: 't1' }],
      { t1: [{ email: 'a@example.com', firstName: 'A' }] },
    );
    const outbox = { publish: vi.fn() };
    const email = { sendEmail: vi.fn().mockResolvedValue({ queued: true }) };

    const svc = new LowStockSchedulerService(
      landlord as never,
      outbox as never,
      email as never,
    );
    const res = await svc.run();

    expect(res).toEqual({ tenantsChecked: 1, alertsSent: 0 });
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(outbox.publish).not.toHaveBeenCalled();
  });

  it('emails every staff recipient once and emits a digest outbox event', async () => {
    (globalThis as { __lowTx?: unknown }).__lowTx = {
      $queryRaw: vi.fn(async () => [
        {
          variantId: 'v1',
          sku: 'SKU-A',
          productTitle: 'Widget',
          stockOnHand: 3,
          stockReserved: 1,
          lowStockThreshold: 5,
        },
      ]),
    };
    const landlord = makeLandlord(
      [{ id: 't1', name: 'Tenant One', subdomain: 't1' }],
      {
        t1: [
          { email: 'owner@example.com', firstName: 'Owner' },
          { email: 'admin@example.com', firstName: 'Admin' },
          { email: 'owner@example.com', firstName: 'Owner' }, // dup
        ],
      },
    );
    const outbox = {
      publish: vi.fn(async () => ({ id: 'ob-1' })),
    };
    const email = { sendEmail: vi.fn(async () => ({ queued: true })) };

    const svc = new LowStockSchedulerService(
      landlord as never,
      outbox as never,
      email as never,
    );
    const res = await svc.run();

    expect(res.tenantsChecked).toBe(1);
    expect(res.alertsSent).toBe(2);
    expect(email.sendEmail).toHaveBeenCalledTimes(2);
    expect(outbox.publish).toHaveBeenCalledOnce();
    const call = outbox.publish.mock.calls[0] as unknown as [
      unknown,
      { eventType: string; payload: { itemCount: number } },
    ];
    expect(call[1].eventType).toBe('inventory.low_stock_digest');
    expect(call[1].payload.itemCount).toBe(1);
  });
});

/**
 * Wishlist service unit tests — mocks Prisma via withTenant monkey-patch.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@ecf/db', () => ({
  withTenant: vi.fn(async (_opts: unknown, cb: (tx: unknown) => unknown) => cb(globalThis.__txRef)),
}));

declare global {
  // eslint-disable-next-line no-var
  var __txRef: unknown;
}

import { WishlistService } from './wishlist.service';

function buildTx(opts: { product?: unknown; existing?: unknown } = {}) {
  return {
    product: {
      findUnique: vi.fn(async () => opts.product ?? { id: 'p1', tenantId: 't1' }),
    },
    wishlistItem: {
      findUnique: vi.fn(async () => opts.existing ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        createdAt: new Date('2026-04-20T12:00:00Z'),
      })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        createdAt: new Date('2026-04-20T12:00:00Z'),
      })),
    },
  };
}

function buildService() {
  const ctx = {
    tenantId: 't1',
    userId: 'u1',
    get: () => ({
      tenant: { tenantId: 't1' },
      userId: 'u1',
      customerId: 'c1',
      audience: 'customer' as const,
      isLandlord: false,
      requestId: 'req-1',
    }),
  };
  const cart = {
    resolveOwner: vi.fn(() => ({ tenantId: 't1', customerId: 'c1', cartToken: null })),
    addItem: vi.fn(async () => ({})),
  };
  return new WishlistService(ctx as never, cart as never);
}

describe('WishlistService.add', () => {
  beforeEach(() => {
    globalThis.__txRef = undefined;
  });

  it('inserts a new wishlist row when no prior entry exists', async () => {
    const tx = buildTx({ existing: null });
    globalThis.__txRef = tx;
    const svc = buildService();
    const row = await svc.add({ productId: 'p1', variantId: 'v1' });
    expect(tx.wishlistItem.create).toHaveBeenCalledTimes(1);
    expect((row as { productId: string }).productId).toBe('p1');
  });

  it('is idempotent — returning existing row when variantId is unchanged', async () => {
    const existing = {
      tenantId: 't1',
      customerId: 'c1',
      productId: 'p1',
      variantId: 'v1',
      createdAt: new Date('2026-04-20T10:00:00Z'),
    };
    const tx = buildTx({ existing });
    globalThis.__txRef = tx;
    const svc = buildService();
    const row = await svc.add({ productId: 'p1', variantId: 'v1' });
    expect(tx.wishlistItem.create).not.toHaveBeenCalled();
    expect(row).toBe(existing);
  });

  it('updates variantId when a different variant is supplied', async () => {
    const existing = {
      tenantId: 't1',
      customerId: 'c1',
      productId: 'p1',
      variantId: 'v1',
      createdAt: new Date('2026-04-20T10:00:00Z'),
    };
    const tx = buildTx({ existing });
    globalThis.__txRef = tx;
    const svc = buildService();
    await svc.add({ productId: 'p1', variantId: 'v2' });
    expect(tx.wishlistItem.update).toHaveBeenCalledTimes(1);
  });
});

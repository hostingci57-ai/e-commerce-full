/**
 * Reviews unit tests — exercise pure helpers (stats, author name) and the
 * verified-buyer + moderation flow via a hand-rolled in-memory Prisma-ish tx.
 *
 * No DB / Prisma imports — the module under test accesses Prisma only through
 * `withTenant`, which we monkey-patch per test to deliver our fake tx.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@ecf/db', () => {
  return {
    withTenant: vi.fn(async (_opts: unknown, cb: (tx: unknown) => unknown) => cb(globalThis.__txRef)),
  };
});

declare global {
  // eslint-disable-next-line no-var
  var __txRef: unknown;
}

import { computeStats, formatAuthorName, ReviewsService } from './reviews.service';

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe('computeStats', () => {
  it('returns zeroes for empty input', () => {
    const r = computeStats([]);
    expect(r.count).toBe(0);
    expect(r.average).toBe(0);
    expect(r.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('computes average + 1-decimal rounding', () => {
    // mean 3.6666 → round-half-up to 3.7
    const r = computeStats([5, 4, 2]);
    expect(r.count).toBe(3);
    expect(r.average).toBe(3.7);
    expect(r.distribution[5]).toBe(1);
    expect(r.distribution[4]).toBe(1);
    expect(r.distribution[2]).toBe(1);
  });

  it('builds the distribution histogram for all 5 buckets', () => {
    const ratings = [5, 5, 5, 4, 4, 3, 2, 1];
    const r = computeStats(ratings);
    expect(r.count).toBe(8);
    expect(r.distribution).toEqual({ 1: 1, 2: 1, 3: 1, 4: 2, 5: 3 });
  });
});

describe('formatAuthorName', () => {
  it('returns "Anonim" when both names are missing', () => {
    expect(formatAuthorName(null, null)).toBe('Anonim');
    expect(formatAuthorName('', '')).toBe('Anonim');
  });

  it('masks last name to initial', () => {
    expect(formatAuthorName('Ayşe', 'Yılmaz')).toBe('Ayşe Y.');
    expect(formatAuthorName('mehmet', 'demir')).toBe('mehmet D.');
  });

  it('shows first name only when last name is missing', () => {
    expect(formatAuthorName('Ada', null)).toBe('Ada');
  });
});

// ---------------------------------------------------------------------------
// Service flow tests — verified-buyer detection + auto-approve
// ---------------------------------------------------------------------------

interface FakeReview {
  id: string;
  tenantId: string;
  productId: string;
  customerId: string;
  orderId: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SPAM';
  isVerifiedBuyer: boolean;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function buildFakeTx(opts: { hasDeliveredOrder: boolean; existingReview?: FakeReview | null } = { hasDeliveredOrder: false }) {
  const reviews: FakeReview[] = [];
  return {
    product: {
      findUnique: vi.fn(async () => ({ id: 'p1', tenantId: 't1', title: 'Test' })),
    },
    productReview: {
      findUnique: vi.fn(async () => opts.existingReview ?? null),
      create: vi.fn(async ({ data }: { data: Omit<FakeReview, 'id' | 'helpfulCount' | 'createdAt' | 'updatedAt'> & Partial<FakeReview> }) => {
        const row: FakeReview = {
          id: `r-${reviews.length + 1}`,
          tenantId: data.tenantId,
          productId: data.productId,
          customerId: data.customerId,
          orderId: data.orderId ?? null,
          rating: data.rating,
          title: data.title ?? null,
          comment: data.comment ?? null,
          status: (data.status ?? 'PENDING') as FakeReview['status'],
          isVerifiedBuyer: Boolean(data.isVerifiedBuyer),
          helpfulCount: 0,
          createdAt: new Date('2026-04-20T10:00:00Z'),
          updatedAt: new Date('2026-04-20T10:00:00Z'),
        };
        reviews.push(row);
        return row;
      }),
    },
    order: {
      findFirst: vi.fn(async () =>
        opts.hasDeliveredOrder ? { id: 'order-1' } : null,
      ),
    },
    outboxEvent: {
      create: vi.fn(async () => ({ id: 'outbox-1' })),
    },
    _reviews: reviews,
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
  const outbox = { publish: vi.fn(async () => ({ id: 'o1' })) };
  return new ReviewsService(ctx as never, outbox as never);
}

describe('ReviewsService.create — verified buyer flow', () => {
  beforeEach(() => {
    globalThis.__txRef = undefined;
  });

  it('auto-approves when customer has a delivered order for the product', async () => {
    const tx = buildFakeTx({ hasDeliveredOrder: true });
    globalThis.__txRef = tx;
    const svc = buildService();
    const review = await svc.create('p1', { rating: 5, comment: 'Harika!' });
    expect(review.isVerifiedBuyer).toBe(true);
    expect(review.status).toBe('APPROVED');
    expect(review.orderId).toBe('order-1');
  });

  it('leaves PENDING when no delivered order exists', async () => {
    const tx = buildFakeTx({ hasDeliveredOrder: false });
    globalThis.__txRef = tx;
    const svc = buildService();
    const review = await svc.create('p1', { rating: 4 });
    expect(review.isVerifiedBuyer).toBe(false);
    expect(review.status).toBe('PENDING');
    expect(review.orderId).toBeNull();
  });

  it('rejects a duplicate review with ConflictException', async () => {
    const existing: FakeReview = {
      id: 'r-prev',
      tenantId: 't1',
      productId: 'p1',
      customerId: 'c1',
      orderId: null,
      rating: 3,
      title: null,
      comment: null,
      status: 'APPROVED',
      isVerifiedBuyer: false,
      helpfulCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tx = buildFakeTx({ hasDeliveredOrder: false, existingReview: existing });
    globalThis.__txRef = tx;
    const svc = buildService();
    await expect(svc.create('p1', { rating: 5 })).rejects.toThrowError(/zaten/);
  });
});

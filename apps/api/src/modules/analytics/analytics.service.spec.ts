/**
 * AnalyticsService unit tests.
 *
 * We mock `@ecf/db` at the module boundary so `withTenant` invokes our fake
 * callback synchronously with a tx stub that forwards `$queryRawUnsafe` calls
 * to a Vitest spy. Six tests cover the three most important methods —
 * `getKpis`, `getRevenueTimeSeries`, and `getTopProducts` — exercising the
 * happy path plus an edge case for each.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- @ecf/db mock -----------------------------------------------------------
// The real `withTenant` opens a Prisma transaction; we inline it so unit tests
// run in-memory without booting the DB driver.
const queryRaw = vi.fn<(sql: string, ...args: unknown[]) => Promise<unknown[]>>();

vi.mock('@ecf/db', () => ({
  withTenant: async <T>(
    _params: { tenantId: string },
    cb: (tx: { $queryRawUnsafe: typeof queryRaw }) => Promise<T>,
  ): Promise<T> => cb({ $queryRawUnsafe: queryRaw }),
}));

import { AnalyticsService } from './analytics.service';

function makeCtx(tenantId: string | null = 'tenant-1') {
  return {
    get tenantId() {
      return tenantId;
    },
    userId: null,
  } as unknown as ConstructorParameters<typeof AnalyticsService>[0];
}

beforeEach(() => {
  queryRaw.mockReset();
});

describe('AnalyticsService.getKpis', () => {
  it('aggregates revenue + orders + new customers for the requested range', async () => {
    // revenue/order count
    queryRaw
      .mockResolvedValueOnce([{ revenue: 500_000n, order_count: 25n }])
      .mockResolvedValueOnce([{ new_count: 7n }]);

    const svc = new AnalyticsService(makeCtx());
    const out = await svc.getKpis({
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.000Z',
    });

    expect(out.revenueMinor).toBe('500000');
    expect(out.orderCount).toBe(25);
    expect(out.newCustomerCount).toBe(7);
    expect(out.averageOrderValueMinor).toBe('20000'); // 500_000 / 25
    // conversion = 25 / (25*20) = 0.05
    expect(out.conversionRate).toBeCloseTo(0.05, 5);
    expect(out.from).toBe('2026-04-01T00:00:00.000Z');
    expect(out.to).toBe('2026-04-30T23:59:59.000Z');
  });

  it('returns zeros and conversion=0 when no orders exist in range', async () => {
    queryRaw
      .mockResolvedValueOnce([{ revenue: 0n, order_count: 0n }])
      .mockResolvedValueOnce([{ new_count: 0n }]);

    const svc = new AnalyticsService(makeCtx());
    const out = await svc.getKpis({});
    expect(out.revenueMinor).toBe('0');
    expect(out.orderCount).toBe(0);
    expect(out.averageOrderValueMinor).toBe('0');
    expect(out.conversionRate).toBe(0);
  });
});

describe('AnalyticsService.getRevenueTimeSeries', () => {
  it('maps each date_trunc row to a RevenuePoint preserving order', async () => {
    const d1 = new Date('2026-04-01T00:00:00Z');
    const d2 = new Date('2026-04-02T00:00:00Z');
    queryRaw.mockResolvedValueOnce([
      { period: d1, revenue: 100_000n, order_count: 3n },
      { period: d2, revenue: 250_000n, order_count: 7n },
    ]);

    const svc = new AnalyticsService(makeCtx());
    const out = await svc.getRevenueTimeSeries({
      from: '2026-04-01',
      to: '2026-04-30',
      granularity: 'day',
    });

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      period: d1.toISOString(),
      revenueMinor: '100000',
      orderCount: 3,
    });
    expect(out[1]).toEqual({
      period: d2.toISOString(),
      revenueMinor: '250000',
      orderCount: 7,
    });
  });

  it("uses a monthly date_trunc when granularity='month'", async () => {
    queryRaw.mockResolvedValueOnce([]);
    const svc = new AnalyticsService(makeCtx());
    await svc.getRevenueTimeSeries({ granularity: 'month' });
    // The SQL string is the 1st arg to $queryRawUnsafe.
    const sql = queryRaw.mock.calls[0]?.[0] as string;
    expect(sql).toContain("date_trunc('month'");
  });
});

describe('AnalyticsService.getTopProducts', () => {
  it('returns rows sorted by revenue with stringified money', async () => {
    queryRaw.mockResolvedValueOnce([
      {
        product_id: 'p1',
        title: 'Widget',
        total_quantity: 12n,
        total_revenue: 800_000n,
      },
      {
        product_id: 'p2',
        title: 'Gadget',
        total_quantity: 3n,
        total_revenue: 150_000n,
      },
    ]);

    const svc = new AnalyticsService(makeCtx());
    const rows = await svc.getTopProducts({ limit: 5 });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      productId: 'p1',
      title: 'Widget',
      totalQuantity: 12,
      totalRevenueMinor: '800000',
    });
    expect(rows[1].totalRevenueMinor).toBe('150000');
  });

  it('clamps limit into [1..50] to guard the SQL LIMIT parameter', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const svc = new AnalyticsService(makeCtx());
    await svc.getTopProducts({ limit: 999 });
    // limit is the 4th parameter after SQL + revenueStatuses + from + to
    const lastCall = queryRaw.mock.calls[0];
    expect(lastCall?.[lastCall.length - 1]).toBe(50);

    queryRaw.mockResolvedValueOnce([]);
    await svc.getTopProducts({ limit: -10 });
    const clampedDown = queryRaw.mock.calls[1];
    expect(clampedDown?.[clampedDown.length - 1]).toBe(1);
  });
});

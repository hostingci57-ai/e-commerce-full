/**
 * Unit tests for OutboxDispatcherService — the polling orchestrator.
 *
 * We stub the Prisma client at the module-level import boundary so the test
 * stays in-memory. Four tests cover: empty-queue no-op, single-tick enqueue,
 * guard against reentrant ticks, and mark* helpers.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Hoist-safe mock: prisma proxy with programmable return values.
const queryRawUnsafe = vi.fn<(sql: string, ...args: unknown[]) => Promise<unknown[]>>();
const executeRawUnsafe = vi.fn<(sql: string, ...args: unknown[]) => Promise<number>>();

vi.mock('@ecf/db', () => ({
  prisma: {
    $queryRawUnsafe: (sql: string, ...args: unknown[]) =>
      queryRawUnsafe(sql, ...args),
    $executeRawUnsafe: (sql: string, ...args: unknown[]) =>
      executeRawUnsafe(sql, ...args),
  },
}));

import { OutboxDispatcherService } from './outbox-dispatcher.service';

function makeService(opts: { batchSize?: number; workers?: boolean } = {}) {
  const queue = {
    add: vi.fn().mockResolvedValue({ id: 'job-id' }),
  };
  const cfg = {
    workersEnabled: opts.workers ?? false, // avoid onModuleInit interval
    outboxDispatchIntervalMs: 5_000,
    outboxDispatchBatchSize: opts.batchSize ?? 100,
    outboxMaxAttempts: 3,
  } as unknown as ConstructorParameters<typeof OutboxDispatcherService>[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new OutboxDispatcherService(cfg, queue as any);
  return { svc, queue, cfg };
}

beforeEach(() => {
  queryRawUnsafe.mockReset();
  executeRawUnsafe.mockReset();
});

describe('OutboxDispatcherService.tick', () => {
  it('is a no-op when no pending rows are claimed', async () => {
    queryRawUnsafe.mockResolvedValueOnce([]);
    const { svc, queue } = makeService();
    const dispatched = await svc.tick();
    expect(dispatched).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enqueues each claimed row on the BullMQ queue with jobId=event.id', async () => {
    queryRawUnsafe.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: 't1',
        aggregateType: 'Order',
        aggregateId: 'o1',
        eventType: 'order.created',
        payload: { foo: 'bar' },
        status: 'publishing',
        attempts: 1,
        availableAt: new Date(),
        publishedAt: null,
        lastError: null,
        createdAt: new Date('2026-04-20T00:00:00Z'),
      },
    ]);
    const { svc, queue } = makeService();
    const dispatched = await svc.tick();
    expect(dispatched).toBe(1);
    expect(queue.add).toHaveBeenCalledTimes(1);
    const call = queue.add.mock.calls[0];
    expect(call[0]).toBe('dispatch');
    expect((call[1] as { id: string }).id).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
    expect((call[2] as { jobId: string }).jobId).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('guards re-entry while a tick is already running', async () => {
    let releaseClaim: (rows: unknown[]) => void = () => undefined;
    queryRawUnsafe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseClaim = resolve as typeof releaseClaim;
        }),
    );
    const { svc } = makeService();
    const first = svc.tick();
    // Second call while the first is mid-flight must short-circuit.
    const second = await svc.tick();
    expect(second).toBe(0);
    releaseClaim([]);
    await first;
  });

  it('markPublished / markFailed / rescheduleForRetry emit correct SQL side-effects', async () => {
    const { svc } = makeService();
    executeRawUnsafe.mockResolvedValue(1);
    await svc.markPublished('e-1');
    await svc.markFailed('e-2', 'boom');
    await svc.rescheduleForRetry('e-3', 2_000, 'transient');
    expect(executeRawUnsafe).toHaveBeenCalledTimes(3);
    const firstSql = String(executeRawUnsafe.mock.calls[0][0]);
    const secondSql = String(executeRawUnsafe.mock.calls[1][0]);
    const thirdSql = String(executeRawUnsafe.mock.calls[2][0]);
    expect(firstSql).toContain("status = 'published'");
    expect(secondSql).toContain("status = 'failed'");
    expect(thirdSql).toContain("status = 'pending'");
  });
});

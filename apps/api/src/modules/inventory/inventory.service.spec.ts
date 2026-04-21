/**
 * InventoryService unit tests. Mocks `withTenant` so we can exercise the
 * service's business logic (movement writes, threshold events, bulk import,
 * stock validation) without a live Postgres. The tx shape is a hand-rolled
 * Prisma stand-in that captures writes into in-memory arrays.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';

// Mock @ecf/db so `withTenant(params, cb)` passes a fake tx through.
vi.mock('@ecf/db', () => {
  return {
    withTenant: vi.fn(async (_params: unknown, cb: (tx: unknown) => unknown) =>
      cb((globalThis as { __fakeTx?: unknown }).__fakeTx),
    ),
  };
});

import { InventoryService } from './inventory.service';

interface LevelRow {
  tenantId: string;
  variantId: string;
  stockOnHand: number;
  stockReserved: number;
  lowStockThreshold: number;
}

interface MovementRow {
  tenantId: string;
  variantId: string;
  type: string;
  quantity: number;
  reason: string | null;
  reference: string | null;
  note: string | null;
  createdBy: string | null;
}

function makeFakeTx() {
  const levels: LevelRow[] = [];
  const variants: Array<{
    id: string;
    tenantId: string;
    sku: string;
    stockOnHand: number;
    stockReserved: number;
  }> = [];
  const movements: MovementRow[] = [];
  const reservations: Array<{
    id: string;
    tenantId: string;
    variantId: string;
    sessionId: string | null;
    quantity: number;
    releasedAt: Date | null;
    orderId: string | null;
    expiresAt: Date;
  }> = [];
  const outboxEvents: Array<{
    tenantId: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
  }> = [];

  const tx = {
    inventoryLevel: {
      findUnique: async ({ where }: { where: { tenantId_variantId: { tenantId: string; variantId: string } } }) =>
        levels.find(
          (l) =>
            l.tenantId === where.tenantId_variantId.tenantId &&
            l.variantId === where.tenantId_variantId.variantId,
        ) ?? null,
      create: async ({ data }: { data: LevelRow }) => {
        const row: LevelRow = {
          tenantId: data.tenantId,
          variantId: data.variantId,
          stockOnHand: data.stockOnHand ?? 0,
          stockReserved: data.stockReserved ?? 0,
          lowStockThreshold: data.lowStockThreshold ?? 5,
        };
        levels.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { tenantId_variantId: { tenantId: string; variantId: string } };
        data: {
          stockOnHand?: { increment: number } | number;
          stockReserved?: { increment: number } | number;
          lowStockThreshold?: number;
        };
      }) => {
        const row = levels.find(
          (l) =>
            l.tenantId === where.tenantId_variantId.tenantId &&
            l.variantId === where.tenantId_variantId.variantId,
        );
        if (!row) throw new Error('no level');
        const onHand = data.stockOnHand as
          | { increment: number }
          | number
          | undefined;
        if (typeof onHand === 'object' && onHand !== null) {
          row.stockOnHand += onHand.increment;
        } else if (typeof onHand === 'number') {
          row.stockOnHand = onHand;
        }
        const reserved = data.stockReserved as
          | { increment: number }
          | number
          | undefined;
        if (typeof reserved === 'object' && reserved !== null) {
          row.stockReserved += reserved.increment;
        } else if (typeof reserved === 'number') {
          row.stockReserved = reserved;
        }
        if (typeof data.lowStockThreshold === 'number') {
          row.lowStockThreshold = data.lowStockThreshold;
        }
        return row;
      },
    },
    productVariant: {
      findUnique: async ({ where }: { where: { id?: string; tenantId_sku?: { tenantId: string; sku: string } } }) => {
        if (where.id) return variants.find((v) => v.id === where.id) ?? null;
        if (where.tenantId_sku) {
          return variants.find(
            (v) =>
              v.tenantId === where.tenantId_sku!.tenantId &&
              v.sku === where.tenantId_sku!.sku,
          ) ?? null;
        }
        return null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          stockOnHand?: { increment: number };
          stockReserved?: { increment: number };
        };
      }) => {
        const v = variants.find((x) => x.id === where.id);
        if (!v) throw new Error('no variant');
        if (data.stockOnHand?.increment !== undefined)
          v.stockOnHand += data.stockOnHand.increment;
        if (data.stockReserved?.increment !== undefined)
          v.stockReserved += data.stockReserved.increment;
        return v;
      },
    },
    inventoryMovement: {
      create: async ({ data }: { data: MovementRow }) => {
        movements.push({ ...data });
        return { id: `mv-${movements.length}` };
      },
      count: async () => movements.length,
      findMany: async () => movements.slice(),
    },
    inventoryReservation: {
      create: async ({ data }: { data: { tenantId: string; variantId: string; sessionId: string; quantity: number; expiresAt: Date } }) => {
        const row = {
          id: `r-${reservations.length + 1}`,
          releasedAt: null,
          orderId: null,
          ...data,
        };
        reservations.push(row);
        return { id: row.id };
      },
      findMany: async ({ where }: { where: { tenantId: string; sessionId: string; releasedAt: null } }) =>
        reservations.filter(
          (r) =>
            r.tenantId === where.tenantId &&
            r.sessionId === where.sessionId &&
            r.releasedAt === null,
        ),
      update: async ({ where, data }: { where: { id: string }; data: { releasedAt: Date; orderId?: string } }) => {
        const r = reservations.find((x) => x.id === where.id);
        if (!r) throw new Error('no reservation');
        r.releasedAt = data.releasedAt;
        if (data.orderId) r.orderId = data.orderId;
        return r;
      },
    },
    outboxEvent: {
      findFirst: async () => null,
    },
    $queryRaw: async () => [] as unknown[],
  };

  // Expose helpers on the same object so tests can assert.
  return Object.assign(tx, {
    __levels: levels,
    __variants: variants,
    __movements: movements,
    __reservations: reservations,
    __outbox: outboxEvents,
  });
}

// Minimal tenant-context stub.
function makeCtx(tenantId = 'tenant-1', userId: string | null = 'user-1') {
  return { tenantId, userId } as { tenantId: string; userId: string | null };
}

// Minimal outbox stub that writes into tx.__outbox via our fake model.
function makeOutbox(store: Array<{ tenantId: string; aggregateType: string; aggregateId: string; eventType: string; payload: unknown }>) {
  return {
    publish: vi.fn(
      async (
        _tx: unknown,
        params: {
          tenantId: string;
          aggregateType: string;
          aggregateId: string;
          eventType: string;
          payload: unknown;
        },
      ) => {
        store.push(params);
        return { id: `ob-${store.length}` };
      },
    ),
  };
}

describe('InventoryService.adjust', () => {
  beforeEach(() => {
    (globalThis as { __fakeTx?: unknown }).__fakeTx = undefined;
  });

  it('adds stock with ADJUSTMENT movement and no low-stock event when above threshold', async () => {
    const tx = makeFakeTx();
    (globalThis as { __fakeTx?: unknown }).__fakeTx = tx;
    tx.__variants.push({
      id: 'v1',
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      stockOnHand: 10,
      stockReserved: 0,
    });
    const outbox = makeOutbox(tx.__outbox);
    const svc = new InventoryService(makeCtx() as never, outbox as never);

    const r = await svc.adjust({
      variantId: 'v1',
      delta: 5,
      reason: 'manual_adjustment',
      note: null,
      reference: null,
    });

    expect(r.stockOnHand).toBe(15);
    expect(r.available).toBe(15);
    expect(tx.__movements.at(-1)).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: 5,
      reason: 'manual_adjustment',
    });
    expect(outbox.publish).not.toHaveBeenCalled();
  });

  it('rejects a delta that drives stock below zero', async () => {
    const tx = makeFakeTx();
    (globalThis as { __fakeTx?: unknown }).__fakeTx = tx;
    tx.__variants.push({
      id: 'v1',
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      stockOnHand: 2,
      stockReserved: 0,
    });
    const outbox = makeOutbox(tx.__outbox);
    const svc = new InventoryService(makeCtx() as never, outbox as never);

    await expect(
      svc.adjust({
        variantId: 'v1',
        delta: -5,
        reason: 'manual_adjustment',
        note: null,
        reference: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('emits inventory.low_stock once stock crosses the threshold', async () => {
    const tx = makeFakeTx();
    (globalThis as { __fakeTx?: unknown }).__fakeTx = tx;
    tx.__variants.push({
      id: 'v1',
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      stockOnHand: 10,
      stockReserved: 0,
    });
    tx.__levels.push({
      tenantId: 'tenant-1',
      variantId: 'v1',
      stockOnHand: 10,
      stockReserved: 0,
      lowStockThreshold: 5,
    });
    const outbox = makeOutbox(tx.__outbox);
    const svc = new InventoryService(makeCtx() as never, outbox as never);

    await svc.adjust({
      variantId: 'v1',
      delta: -6,
      reason: 'damage',
      note: null,
      reference: null,
    });

    expect(outbox.publish).toHaveBeenCalledOnce();
    const [, ev] = outbox.publish.mock.calls[0];
    expect(ev.eventType).toBe('inventory.low_stock');
  });

  it('emits inventory.out_of_stock when on-hand reaches zero', async () => {
    const tx = makeFakeTx();
    (globalThis as { __fakeTx?: unknown }).__fakeTx = tx;
    tx.__variants.push({
      id: 'v1',
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      stockOnHand: 3,
      stockReserved: 0,
    });
    tx.__levels.push({
      tenantId: 'tenant-1',
      variantId: 'v1',
      stockOnHand: 3,
      stockReserved: 0,
      lowStockThreshold: 5,
    });
    const outbox = makeOutbox(tx.__outbox);
    const svc = new InventoryService(makeCtx() as never, outbox as never);

    await svc.adjust({
      variantId: 'v1',
      delta: -3,
      reason: 'damage',
      note: null,
      reference: null,
    });

    expect(outbox.publish).toHaveBeenCalledOnce();
    const [, ev] = outbox.publish.mock.calls[0];
    expect(ev.eventType).toBe('inventory.out_of_stock');
  });
});

describe('InventoryService.reserve / confirm / release', () => {
  beforeEach(() => {
    (globalThis as { __fakeTx?: unknown }).__fakeTx = undefined;
  });

  it('reserve writes a RESERVATION movement and bumps stockReserved', async () => {
    const tx = makeFakeTx();
    (globalThis as { __fakeTx?: unknown }).__fakeTx = tx;
    tx.__variants.push({
      id: 'v1',
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      stockOnHand: 20,
      stockReserved: 0,
    });
    const outbox = makeOutbox(tx.__outbox);
    const svc = new InventoryService(makeCtx() as never, outbox as never);

    const res = await svc.reserve(
      [{ variantId: 'v1', quantity: 3 }],
      'sess-1',
      15,
    );

    expect(res.reservationIds).toHaveLength(1);
    expect(tx.__variants[0].stockReserved).toBe(3);
    expect(tx.__levels[0].stockReserved).toBe(3);
    expect(tx.__movements.at(-1)).toMatchObject({
      type: 'RESERVATION',
      quantity: -3,
    });
  });

  it('confirm writes a FULFILLMENT movement and decrements both counters', async () => {
    const tx = makeFakeTx();
    (globalThis as { __fakeTx?: unknown }).__fakeTx = tx;
    tx.__variants.push({
      id: 'v1',
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      stockOnHand: 20,
      stockReserved: 3,
    });
    tx.__levels.push({
      tenantId: 'tenant-1',
      variantId: 'v1',
      stockOnHand: 20,
      stockReserved: 3,
      lowStockThreshold: 5,
    });
    tx.__reservations.push({
      id: 'r-1',
      tenantId: 'tenant-1',
      variantId: 'v1',
      sessionId: 'sess-1',
      quantity: 3,
      releasedAt: null,
      orderId: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const outbox = makeOutbox(tx.__outbox);
    const svc = new InventoryService(makeCtx() as never, outbox as never);

    await svc.confirm('sess-1', 'order-1');

    expect(tx.__variants[0].stockOnHand).toBe(17);
    expect(tx.__variants[0].stockReserved).toBe(0);
    expect(tx.__levels[0].stockOnHand).toBe(17);
    expect(tx.__movements.at(-1)).toMatchObject({
      type: 'FULFILLMENT',
      quantity: -3,
      reference: 'order-1',
    });
  });

  it('release only rolls back stockReserved and writes a RELEASE movement', async () => {
    const tx = makeFakeTx();
    (globalThis as { __fakeTx?: unknown }).__fakeTx = tx;
    tx.__variants.push({
      id: 'v1',
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      stockOnHand: 20,
      stockReserved: 4,
    });
    tx.__levels.push({
      tenantId: 'tenant-1',
      variantId: 'v1',
      stockOnHand: 20,
      stockReserved: 4,
      lowStockThreshold: 5,
    });
    tx.__reservations.push({
      id: 'r-1',
      tenantId: 'tenant-1',
      variantId: 'v1',
      sessionId: 'sess-1',
      quantity: 4,
      releasedAt: null,
      orderId: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const outbox = makeOutbox(tx.__outbox);
    const svc = new InventoryService(makeCtx() as never, outbox as never);

    await svc.release('sess-1');

    expect(tx.__variants[0].stockOnHand).toBe(20);
    expect(tx.__variants[0].stockReserved).toBe(0);
    expect(tx.__movements.at(-1)).toMatchObject({
      type: 'RELEASE',
      quantity: 4,
    });
  });

  it('rejects an empty reserve call', async () => {
    const outbox = makeOutbox([]);
    const svc = new InventoryService(makeCtx() as never, outbox as never);
    await expect(svc.reserve([], 'sess-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('InventoryService.bulkImport', () => {
  beforeEach(() => {
    (globalThis as { __fakeTx?: unknown }).__fakeTx = undefined;
  });

  it('imports rows by SKU and records per-row adjustment movements', async () => {
    const tx = makeFakeTx();
    (globalThis as { __fakeTx?: unknown }).__fakeTx = tx;
    tx.__variants.push({
      id: 'v1',
      tenantId: 'tenant-1',
      sku: 'SKU-A',
      stockOnHand: 5,
      stockReserved: 0,
    });
    tx.__variants.push({
      id: 'v2',
      tenantId: 'tenant-1',
      sku: 'SKU-B',
      stockOnHand: 10,
      stockReserved: 0,
    });
    const outbox = makeOutbox(tx.__outbox);
    const svc = new InventoryService(makeCtx() as never, outbox as never);

    const r = await svc.bulkImport({
      items: [
        { variantSku: 'SKU-A', stockOnHand: 20, lowStockThreshold: 3 },
        { variantSku: 'SKU-UNKNOWN', stockOnHand: 10 },
      ],
    });

    expect(r.succeeded).toBe(1);
    expect(r.failed).toEqual([
      { sku: 'SKU-UNKNOWN', reason: 'variant_not_found' },
    ]);
    const levelA = tx.__levels.find((l) => l.variantId === 'v1')!;
    expect(levelA.stockOnHand).toBe(20);
    expect(levelA.lowStockThreshold).toBe(3);
    expect(tx.__movements.at(-1)).toMatchObject({
      type: 'ADJUSTMENT',
      reason: 'bulk_import',
      quantity: 15,
    });
  });
});

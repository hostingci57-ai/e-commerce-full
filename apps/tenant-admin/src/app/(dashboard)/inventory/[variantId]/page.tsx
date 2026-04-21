'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Boxes, History } from 'lucide-react';
import {
  getInventoryLevel,
  listInventoryLevels,
  listMovements,
  type InventoryLevelRow,
  type InventoryMovementRow,
  type InventoryMovementType,
} from '@/lib/queries';
import { Badge, Button } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { InventoryAdjustDialog } from '@/components/InventoryAdjustDialog';
import { InventoryThresholdDialog } from '@/components/InventoryThresholdDialog';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_STYLE: Record<
  InventoryMovementType,
  { label: string; tone: 'slate' | 'indigo' | 'green' | 'amber' | 'rose' }
> = {
  INITIAL: { label: 'İlk Giriş', tone: 'indigo' },
  ADJUSTMENT: { label: 'Düzeltme', tone: 'slate' },
  RESERVATION: { label: 'Rezerve', tone: 'amber' },
  RELEASE: { label: 'Serbest', tone: 'slate' },
  FULFILLMENT: { label: 'Gönderim', tone: 'green' },
  RETURN: { label: 'İade', tone: 'green' },
  DAMAGE: { label: 'Hasar', tone: 'rose' },
};

export default function InventoryVariantPage() {
  const params = useParams<{ variantId: string }>();
  const variantId = params.variantId;
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  const levelQ = useQuery({
    queryKey: ['inventory-level', variantId],
    queryFn: () => getInventoryLevel(variantId),
  });

  // The level endpoint returns a skinny record — pair it with the row-shape
  // used by the dialogs by re-using the list endpoint filtered to the sku.
  const rowQ = useQuery({
    queryKey: ['inventory-row', variantId],
    queryFn: () => listInventoryLevels({ page: 1, limit: 200 }),
    select: (d) => d.items.find((i) => i.variantId === variantId) ?? null,
  });
  const row: InventoryLevelRow | null = rowQ.data ?? null;

  const movementsQ = useQuery({
    queryKey: ['inventory-movements', variantId, page],
    queryFn: () => listMovements({ variantId, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<InventoryMovementRow>[] = [
    {
      key: 'createdAt',
      header: 'Tarih',
      render: (r) => formatDateTime(r.createdAt),
    },
    {
      key: 'type',
      header: 'Tip',
      render: (r) => {
        const s = TYPE_STYLE[r.type];
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
    {
      key: 'quantity',
      header: 'Miktar',
      render: (r) => (
        <span
          className={
            r.quantity < 0
              ? 'font-semibold text-red-600'
              : 'font-semibold text-emerald-600'
          }
        >
          {r.quantity > 0 ? '+' : ''}
          {r.quantity}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Sebep',
      render: (r) => r.reason ?? '—',
    },
    {
      key: 'reference',
      header: 'Referans',
      render: (r) => r.reference ?? '—',
    },
    {
      key: 'note',
      header: 'Not',
      render: (r) => (
        <span className="text-slate-600">{r.note ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Stok listesine dön
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Boxes className="h-6 w-6 text-brand-600" /> {row?.sku ?? '…'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {row?.productTitle ?? 'Varyant detayı'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setThresholdOpen(true)} disabled={!row}>
            Eşik Güncelle
          </Button>
          <Button onClick={() => setAdjustOpen(true)} disabled={!row}>
            Stok Düzelt
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Mevcut Stok" value={levelQ.data?.stockOnHand ?? 0} />
        <StatCard title="Rezerve" value={levelQ.data?.stockReserved ?? 0} />
        <StatCard
          title="Uygun (Satılabilir)"
          value={levelQ.data?.available ?? 0}
          accent={
            (levelQ.data?.available ?? 0) <= 0
              ? 'red'
              : (levelQ.data?.available ?? 0) <= (levelQ.data?.lowStockThreshold ?? 0)
                ? 'amber'
                : 'emerald'
          }
        />
        <StatCard title="Düşük Stok Eşiği" value={levelQ.data?.lowStockThreshold ?? 0} />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Hareket Geçmişi
          </h2>
        </div>
        <DataTable<InventoryMovementRow>
          rows={movementsQ.data?.items ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={movementsQ.isLoading}
          empty="Bu varyant için hareket bulunmuyor."
          pagination={{
            page,
            pageSize: 25,
            total: movementsQ.data?.total ?? 0,
            onPageChange: setPage,
          }}
        />
      </div>

      <InventoryAdjustDialog
        row={row}
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
      />
      <InventoryThresholdDialog
        row={row}
        open={thresholdOpen}
        onClose={() => setThresholdOpen(false)}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: number | string;
  accent?: 'emerald' | 'amber' | 'red';
}) {
  const tone =
    accent === 'red'
      ? 'text-red-600'
      : accent === 'amber'
        ? 'text-amber-700'
        : accent === 'emerald'
          ? 'text-emerald-700'
          : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

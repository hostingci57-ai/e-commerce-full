'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Boxes, Download, History, Search, SlidersHorizontal, Upload } from 'lucide-react';
import {
  bulkImportInventory,
  listInventoryLevels,
  type InventoryLevelRow,
} from '@/lib/queries';
import { Badge, Button, Input, Label } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { InventoryAdjustDialog } from '@/components/InventoryAdjustDialog';
import { InventoryThresholdDialog } from '@/components/InventoryThresholdDialog';
import { getAccessToken } from '@/lib/auth-store';
import { API_PREFIX, API_URL } from '@/lib/env';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<
  InventoryLevelRow['status'],
  { label: string; tone: 'green' | 'amber' | 'rose' }
> = {
  in_stock: { label: 'Stokta', tone: 'green' },
  low: { label: 'Düşük', tone: 'amber' },
  out: { label: 'Tükendi', tone: 'rose' },
};

export default function InventoryPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [oosOnly, setOosOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [adjustRow, setAdjustRow] = useState<InventoryLevelRow | null>(null);
  const [thresholdRow, setThresholdRow] = useState<InventoryLevelRow | null>(null);

  const dataQ = useQuery({
    queryKey: ['inventory', { query, lowOnly, oosOnly, page }],
    queryFn: () =>
      listInventoryLevels({
        query: query || undefined,
        lowStock: lowOnly || undefined,
        outOfStock: oosOnly || undefined,
        page,
        limit: 25,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = dataQ.data?.items ?? [];

  const importMut = useMutation({
    mutationFn: bulkImportInventory,
    onSuccess: (res) => {
      toast.success(`İçe aktarıldı: ${res.succeeded} satır (${res.failed.length} hata)`);
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'İçe aktarım başarısız'),
  });

  async function handleImport(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      toast.error('CSV boş veya geçersiz');
      return;
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const skuIdx = header.findIndex((h) => h === 'sku' || h === 'variantsku' || h === 'variant_sku');
    const stockIdx = header.findIndex(
      (h) => h === 'stock' || h === 'stockonhand' || h === 'stock_on_hand',
    );
    const thrIdx = header.findIndex(
      (h) => h === 'threshold' || h === 'lowstockthreshold' || h === 'low_stock_threshold',
    );
    if (skuIdx < 0 || stockIdx < 0) {
      toast.error('CSV başlığında sku ve stock_on_hand sütunu bulunmalı');
      return;
    }
    const items = lines.slice(1).map((l) => {
      const cols = l.split(',');
      const row: { variantSku: string; stockOnHand: number; lowStockThreshold?: number } = {
        variantSku: (cols[skuIdx] ?? '').trim(),
        stockOnHand: parseInt((cols[stockIdx] ?? '0').trim(), 10) || 0,
      };
      if (thrIdx >= 0 && cols[thrIdx]) {
        const n = parseInt(cols[thrIdx].trim(), 10);
        if (!Number.isNaN(n)) row.lowStockThreshold = n;
      }
      return row;
    });
    if (items.length === 0) {
      toast.error('İçe aktarılacak satır yok');
      return;
    }
    importMut.mutate(items);
  }

  async function handleExport() {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}${API_PREFIX}/inventory/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    });
    if (!res.ok) {
      toast.error('Dışa aktarım başarısız');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<Column<InventoryLevelRow>[]>(
    () => [
      {
        key: 'sku',
        header: 'SKU',
        render: (r) => (
          <Link
            href={`/inventory/${r.variantId}`}
            className="font-mono text-sm font-semibold text-brand-700 hover:underline"
          >
            {r.sku}
          </Link>
        ),
      },
      {
        key: 'title',
        header: 'Ürün',
        render: (r) => (
          <div className="text-sm">
            <div className="font-medium text-slate-900">{r.productTitle}</div>
          </div>
        ),
      },
      {
        key: 'onHand',
        header: 'Stok',
        render: (r) => <span className="font-semibold">{r.stockOnHand}</span>,
      },
      {
        key: 'reserved',
        header: 'Rezerve',
        render: (r) => <span className="text-slate-600">{r.stockReserved}</span>,
      },
      {
        key: 'available',
        header: 'Uygun',
        render: (r) => (
          <span
            className={
              r.available <= 0
                ? 'font-semibold text-red-600'
                : r.available <= r.lowStockThreshold
                  ? 'font-semibold text-amber-700'
                  : 'font-semibold text-emerald-700'
            }
          >
            {r.available}
          </span>
        ),
      },
      {
        key: 'threshold',
        header: 'Eşik',
        render: (r) => r.lowStockThreshold,
      },
      {
        key: 'status',
        header: 'Durum',
        render: (r) => {
          const s = STATUS_STYLES[r.status];
          return <Badge tone={s.tone}>{s.label}</Badge>;
        },
      },
      {
        key: 'actions',
        header: '',
        render: (r) => (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setAdjustRow(r);
              }}
            >
              <SlidersHorizontal className="h-4 w-4" /> Stok Düzelt
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setThresholdRow(r);
              }}
            >
              Eşik
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Boxes className="h-6 w-6 text-brand-600" /> Stok Yönetimi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Varyant bazında stok seviyelerini görüntüleyin, düzeltin ve düşük stok uyarılarını yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2">
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Upload className="h-4 w-4" /> CSV İçe Aktar
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" /> CSV İndir
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="SKU veya ürün ara…"
            className="pl-9"
          />
        </div>
        <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              setLowOnly(e.target.checked);
              setPage(1);
            }}
          />
          Sadece düşük + tükenen
        </label>
        <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={oosOnly}
            onChange={(e) => {
              setOosOnly(e.target.checked);
              setPage(1);
            }}
          />
          Sadece tükenen
        </label>
      </div>

      <DataTable<InventoryLevelRow>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.variantId}
        loading={dataQ.isLoading}
        empty={
          <div className="flex flex-col items-center gap-2 py-6 text-slate-500">
            <History className="h-8 w-8 text-slate-300" />
            <p>Stok kaydı bulunamadı.</p>
          </div>
        }
        pagination={{
          page,
          pageSize: 25,
          total: dataQ.data?.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <InventoryAdjustDialog
        row={adjustRow}
        open={!!adjustRow}
        onClose={() => setAdjustRow(null)}
      />
      <InventoryThresholdDialog
        row={thresholdRow}
        open={!!thresholdRow}
        onClose={() => setThresholdRow(null)}
      />
    </div>
  );
}

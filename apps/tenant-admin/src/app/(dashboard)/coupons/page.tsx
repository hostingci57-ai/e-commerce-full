'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Percent, Plus, Search, Trash2 } from 'lucide-react';
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  updateCoupon,
  type CouponListItem,
} from '@/lib/queries';
import { Badge, Button, Input, Select } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { CouponForm } from '@/components/CouponForm';
import { formatDateTime, formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<CouponListItem['type'], string> = {
  PERCENT: 'Yüzde',
  FIXED: 'Sabit',
  FREE_SHIPPING: 'Kargo',
};

function formatCouponValue(row: CouponListItem): string {
  if (row.type === 'PERCENT') {
    const n = Number(row.value);
    return Number.isFinite(n) ? `%${(n / 100).toFixed(2)}` : '-';
  }
  if (row.type === 'FIXED') {
    return formatMoney(row.value, 'TRY');
  }
  return '—';
}

export default function CouponsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CouponListItem | null>(null);

  const isActive =
    status === 'active' ? true : status === 'inactive' ? false : undefined;

  const couponsQ = useQuery({
    queryKey: ['coupons', { query, isActive }],
    queryFn: () => listCoupons({ query: query || undefined, isActive }),
    placeholderData: (prev) => prev,
  });

  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof createCoupon>[0]) => createCoupon(body),
    onSuccess: () => {
      toast.success('Kupon oluşturuldu');
      qc.invalidateQueries({ queryKey: ['coupons'] });
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kupon oluşturulamadı'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CouponListItem> }) =>
      updateCoupon(id, body),
    onSuccess: () => {
      toast.success('Kupon güncellendi');
      qc.invalidateQueries({ queryKey: ['coupons'] });
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kupon güncellenemedi'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => {
      toast.success('Kupon deaktive edildi');
      qc.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kupon kaldırılamadı'),
  });

  const rows = couponsQ.data?.items ?? [];

  const columns = useMemo<Column<CouponListItem>[]>(
    () => [
      {
        key: 'code',
        header: 'Kod',
        render: (r) => (
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-slate-900">{r.code}</span>
            {!r.isActive ? <Badge tone="slate">Pasif</Badge> : null}
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Tip',
        render: (r) => <Badge tone="indigo">{TYPE_LABELS[r.type]}</Badge>,
      },
      {
        key: 'value',
        header: 'Değer',
        render: (r) => formatCouponValue(r),
      },
      {
        key: 'usage',
        header: 'Kullanım',
        render: (r) =>
          `${r.usageCount} / ${r.usageLimit ?? '∞'}`,
      },
      {
        key: 'ends',
        header: 'Bitiş',
        render: (r) => (r.endsAt ? formatDateTime(r.endsAt) : '—'),
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
                setEditing(r);
                setOpen(true);
              }}
            >
              Düzenle
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`${r.code} kuponunu deaktive et?`)) deleteMut.mutate(r.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [deleteMut],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Percent className="h-6 w-6 text-brand-600" /> Kuponlar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kampanya ve indirim kuponlarını buradan yönetin.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Yeni kupon
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kod ara…"
            className="pl-9"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="inactive">Pasif</option>
        </Select>
      </div>

      <DataTable<CouponListItem>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={couponsQ.isLoading}
        empty="Henüz kupon tanımlanmadı."
      />

      <CouponForm
        open={open}
        initial={editing}
        busy={createMut.isPending || updateMut.isPending}
        onClose={() => setOpen(false)}
        onSubmit={async (wire) => {
          if (editing) {
            await updateMut.mutateAsync({ id: editing.id, body: wire });
          } else {
            await createMut.mutateAsync(wire);
          }
        }}
      />
    </div>
  );
}

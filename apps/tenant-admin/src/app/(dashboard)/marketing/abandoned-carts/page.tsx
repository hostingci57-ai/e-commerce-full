'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, CheckCircle2, XCircle } from 'lucide-react';
import {
  listAbandonedCarts,
  sendAbandonedCartEmail,
  type AbandonedCartRow,
} from '@/lib/queries';
import { Badge, Button, Select } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { formatDateTime, formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function AbandonedCartsPage() {
  const qc = useQueryClient();
  const [recovered, setRecovered] = useState<'all' | 'true' | 'false'>('all');

  const cartsQ = useQuery({
    queryKey: ['abandoned-carts', { recovered }],
    queryFn: () =>
      listAbandonedCarts({
        recovered: recovered === 'all' ? undefined : recovered === 'true',
        limit: 50,
      }),
    placeholderData: (prev) => prev,
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => sendAbandonedCartEmail(id),
    onSuccess: () => {
      toast.success('Kurtarma e-postası gönderildi');
      qc.invalidateQueries({ queryKey: ['abandoned-carts'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Gönderim başarısız'),
  });

  const columns: Column<AbandonedCartRow>[] = [
    {
      key: 'customer',
      header: 'Müşteri',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.customerEmail ?? (row.customerId ? 'Kayıtlı müşteri' : 'Misafir')}
          </p>
          <p className="text-xs text-slate-500 font-mono truncate max-w-xs" title={row.cartToken}>
            {row.cartToken}
          </p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Ürünler',
      render: (row) => (
        <div className="max-w-md text-sm text-slate-700">
          {row.itemsSnapshot.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            <ul className="space-y-0.5">
              {row.itemsSnapshot.slice(0, 3).map((i) => (
                <li key={i.variantId} className="truncate">
                  {i.title} × {i.qty}
                </li>
              ))}
              {row.itemsSnapshot.length > 3 ? (
                <li className="text-xs text-slate-500">+{row.itemsSnapshot.length - 3} daha</li>
              ) : null}
            </ul>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Tutar',
      render: (row) => (
        <span className="font-medium tabular-nums">
          {formatMoney(row.totalAmount, row.currency)}
        </span>
      ),
      width: '140px',
    },
    {
      key: 'status',
      header: 'Durum',
      render: (row) =>
        row.recoveredAt ? (
          <Badge tone="green">
            <CheckCircle2 className="h-3 w-3" /> Kurtarıldı
          </Badge>
        ) : row.recoveryEmailSentAt ? (
          <Badge tone="blue">E-posta Gönderildi</Badge>
        ) : (
          <Badge tone="amber">
            <XCircle className="h-3 w-3" /> Bekliyor
          </Badge>
        ),
      width: '160px',
    },
    {
      key: 'createdAt',
      header: 'Oluşturulma',
      render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>,
      width: '160px',
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          disabled={!row.customerEmail || !!row.recoveredAt || sendMut.isPending}
          onClick={() => sendMut.mutate(row.id)}
        >
          <Mail className="mr-1 h-3.5 w-3.5" /> E-posta Gönder
        </Button>
      ),
      width: '180px',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Terk Edilmiş Sepetler</h1>
          <p className="text-sm text-slate-500">
            Son 60 dakikadır hareket görmeyen sepetler otomatik olarak buraya düşer.
          </p>
        </div>
        <label className="flex flex-col text-xs text-slate-600">
          Durum
          <Select
            value={recovered}
            onChange={(e) => setRecovered(e.target.value as 'all' | 'true' | 'false')}
            className="mt-1"
          >
            <option value="all">Tümü</option>
            <option value="false">Kurtarılmamış</option>
            <option value="true">Kurtarılmış</option>
          </Select>
        </label>
      </div>
      <DataTable
        rows={cartsQ.data?.items ?? []}
        columns={columns}
        rowKey={(r) => r.id}
        loading={cartsQ.isLoading}
        empty={<span className="text-sm text-slate-500">Terk edilmiş sepet yok.</span>}
      />
    </div>
  );
}

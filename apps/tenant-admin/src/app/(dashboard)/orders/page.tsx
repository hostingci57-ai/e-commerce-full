'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { listOrders, type OrderListItem, type PaginatedResponse } from '@/lib/queries';
import { Input, Select } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { OrderStatusPill } from '@/components/OrderStatusPill';
import { formatDateTime, formatMoney } from '@/lib/format';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

export default function OrdersPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { q, status, from, to, page }],
    queryFn: () =>
      listOrders({
        q: q || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const rows: OrderListItem[] = data?.items ?? [];
  const total = (data as PaginatedResponse<OrderListItem> | undefined)?.total ?? rows.length;

  const columns: Column<OrderListItem>[] = [
    {
      key: 'orderNumber',
      header: 'Sipariş',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900">
            {r.orderNumber ?? r.id.slice(0, 8)}
          </div>
          <div className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Müşteri',
      render: (r) =>
        r.customer ? (
          <div>
            <div className="text-slate-700">{r.customer.name ?? r.customer.email}</div>
            {r.customer.email ? (
              <div className="text-xs text-slate-500">{r.customer.email}</div>
            ) : null}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: 'Durum',
      render: (r) => <OrderStatusPill status={r.status as OrderStatus} />,
    },
    {
      key: 'total',
      header: 'Tutar',
      render: (r) => formatMoney(r.totalAmount ?? 0, r.currency ?? 'TRY'),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Siparişler</h1>
        <p className="mt-1 text-sm text-slate-500">
          Siparişleri filtreleyin, detaylara inin, durumlarını yönetin.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Sipariş / müşteri ara…"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">Tüm durumlar</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            setPage(1);
            setFrom(e.target.value);
          }}
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            setPage(1);
            setTo(e.target.value);
          }}
        />
      </div>

      <DataTable<OrderListItem>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={isLoading}
        onRowClick={(r) => router.push(`/orders/${r.id}`)}
        pagination={{ page, pageSize, total, onPageChange: setPage }}
        empty="Henüz sipariş yok."
      />
    </div>
  );
}

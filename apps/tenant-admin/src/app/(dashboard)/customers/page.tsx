'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { listCustomers, type CustomerListItem, type PaginatedResponse } from '@/lib/queries';
import { Input } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function CustomersPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { q, page }],
    queryFn: () => listCustomers({ q: q || undefined, page, pageSize }),
    placeholderData: (prev) => prev,
  });

  const rows: CustomerListItem[] = data?.items ?? [];
  const total = (data as PaginatedResponse<CustomerListItem> | undefined)?.total ?? rows.length;

  const columns: Column<CustomerListItem>[] = [
    {
      key: 'name',
      header: 'Ad Soyad',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900">
            {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}
          </div>
          <div className="text-xs text-slate-500">{r.email}</div>
        </div>
      ),
    },
    { key: 'phone', header: 'Telefon', render: (r) => r.phone ?? '—' },
    { key: 'createdAt', header: 'Kayıt', render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Müşteriler</h1>
        <p className="mt-1 text-sm text-slate-500">Müşteri kayıtlarını görüntüleyin.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="E-posta / ad ara…"
          className="pl-9"
        />
      </div>

      <DataTable<CustomerListItem>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={isLoading}
        onRowClick={(r) => router.push(`/customers/${r.id}`)}
        pagination={{ page, pageSize, total, onPageChange: setPage }}
        empty="Henüz müşteri yok."
      />
    </div>
  );
}

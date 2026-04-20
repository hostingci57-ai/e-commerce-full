'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { listProducts, type PaginatedResponse, type ProductListItem } from '@/lib/queries';
import { Badge, Button, Input, Select } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { formatDate, formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc',
  });

  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['products', { q, status, page, sort }],
    queryFn: () =>
      listProducts({
        q: q || undefined,
        status: status || undefined,
        page,
        pageSize,
        sort: `${sort.key}:${sort.direction}`,
      }),
    placeholderData: (prev) => prev,
  });

  const rows: ProductListItem[] = data?.items ?? [];
  const total = (data as PaginatedResponse<ProductListItem> | undefined)?.total ?? rows.length;

  const columns: Column<ProductListItem>[] = [
    {
      key: 'name',
      header: 'Ürün',
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900">{r.name}</div>
          <div className="text-xs text-slate-500">/{r.slug}</div>
        </div>
      ),
    },
    {
      key: 'brand',
      header: 'Marka',
      render: (r) => r.brand?.name ?? '—',
    },
    {
      key: 'status',
      header: 'Durum',
      sortable: true,
      render: (r) => (
        <Badge tone={r.status === 'active' ? 'green' : r.status === 'draft' ? 'amber' : 'slate'}>
          {r.status === 'active' ? 'Yayında' : r.status === 'draft' ? 'Taslak' : 'Arşiv'}
        </Badge>
      ),
    },
    {
      key: 'basePrice',
      header: 'Fiyat',
      sortable: true,
      render: (r) => formatMoney(r.basePrice ?? 0),
    },
    {
      key: 'stock',
      header: 'Stok',
      render: (r) => r.stock ?? '—',
    },
    {
      key: 'createdAt',
      header: 'Oluşturulma',
      sortable: true,
      render: (r) => formatDate(r.createdAt),
    },
  ];

  const onSortChange = (key: string) => {
    setSort((s) =>
      s.key === key
        ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ürünler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ürün kataloğunuzu yönetin.
          </p>
        </div>
        <Link href="/products/new">
          <Button>
            <Plus className="h-4 w-4" /> Yeni Ürün
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Ürün ara…"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="sm:w-48"
        >
          <option value="">Tüm durumlar</option>
          <option value="active">Yayında</option>
          <option value="draft">Taslak</option>
          <option value="archived">Arşiv</option>
        </Select>
      </div>

      <DataTable<ProductListItem>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={isLoading}
        sort={sort}
        onSortChange={onSortChange}
        onRowClick={(r) => router.push(`/products/${r.id}`)}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
        }}
        empty="Henüz ürün yok. Yeni ürün ekleyin."
      />
    </div>
  );
}

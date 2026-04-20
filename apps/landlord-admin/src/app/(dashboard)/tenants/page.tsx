'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge, tenantStatusTone } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface TenantListItem {
  id: string;
  subdomain: string;
  name: string;
  status: 'trial' | 'active' | 'suspended' | 'cancelled' | 'deleted';
  createdAt: string;
  plan?: { id: string; code: string; name: string } | null;
}

interface TenantListResponse {
  items: TenantListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

export default function TenantsPage(): JSX.Element {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<TenantListResponse>({
    queryKey: ['tenants', { q, status, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      return api<TenantListResponse>(`/v1/landlord/tenants?${params.toString()}`);
    },
  });

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="p-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tenantlar</h1>
          <p className="text-sm text-gray-500">{data ? `${data.total} kayıt` : '...'}</p>
        </div>
        <Link href="/tenants/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            Yeni Tenant
          </Button>
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Ad veya subdomain ara"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
        </div>
        <div className="w-40">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tüm durumlar</option>
            <option value="trial">Deneme</option>
            <option value="active">Aktif</option>
            <option value="suspended">Askıda</option>
            <option value="cancelled">İptal</option>
            <option value="deleted">Silindi</option>
          </Select>
        </div>
      </div>

      {isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Tenant listesi yüklenemedi.
        </div>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>Tenant</TH>
            <TH>Subdomain</TH>
            <TH>Paket</TH>
            <TH>Durum</TH>
            <TH>Oluşturuldu</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {isLoading ? (
            <TR>
              <TD className="text-gray-500" {...{ colSpan: 6 } as object}>
                Yükleniyor...
              </TD>
            </TR>
          ) : data && data.items.length > 0 ? (
            data.items.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium text-gray-900">{t.name}</TD>
                <TD className="text-gray-600">{t.subdomain}</TD>
                <TD>{t.plan?.name ?? '—'}</TD>
                <TD>
                  <Badge tone={tenantStatusTone(t.status)}>{t.status}</Badge>
                </TD>
                <TD className="text-gray-500">{formatDate(t.createdAt)}</TD>
                <TD className="text-right">
                  <Link href={`/tenants/${t.id}`} className="text-brand-600 hover:underline">
                    Detay
                  </Link>
                </TD>
              </TR>
            ))
          ) : (
            <TR>
              <TD className="text-gray-500" {...{ colSpan: 6 } as object}>
                Kayıt yok.
              </TD>
            </TR>
          )}
        </TBody>
      </Table>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          Sayfa {page} / {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Önceki
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Sonraki
          </Button>
        </div>
      </div>
    </div>
  );
}

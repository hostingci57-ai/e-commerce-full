'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getCustomer } from '@/lib/queries';
import { Button, Card, CardBody, CardHeader } from '@/components/ui';
import { OrderStatusPill } from '@/components/OrderStatusPill';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import type { OrderStatus } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

interface CustomerDetail {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  createdAt?: string;
  addresses?: {
    id: string;
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  }[];
  orders?: {
    id: string;
    orderNumber?: string;
    status: OrderStatus;
    totalAmount?: number | string;
    currency?: string;
    createdAt?: string;
  }[];
  kvkkConsents?: {
    id: string;
    type: string;
    granted: boolean;
    createdAt: string;
  }[];
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const q = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id),
    enabled: !!id,
  });

  if (q.isLoading) return <div className="text-slate-500">Yükleniyor…</div>;
  if (q.isError || !q.data) {
    return <div className="text-rose-600">Müşteri yüklenemedi.</div>;
  }

  const c = q.data as unknown as CustomerDetail;
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Geri
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{fullName}</h1>
          <p className="mt-1 text-sm text-slate-500">{c.email}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Siparişler" description={`Toplam ${c.orders?.length ?? 0}`} />
            <CardBody className="p-0">
              {(c.orders ?? []).length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Henüz sipariş yok.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Sipariş
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Durum
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tarih
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tutar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.orders!.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/orders/${o.id}`}
                            className="font-medium text-brand-600 hover:underline"
                          >
                            {o.orderNumber ?? o.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusPill status={o.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDateTime(o.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatMoney(o.totalAmount ?? 0, o.currency ?? 'TRY')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="KVKK Onayları" />
            <CardBody className="p-0">
              {(c.kvkkConsents ?? []).length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Kayıt yok.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {c.kvkkConsents!.map((k) => (
                    <li key={k.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium text-slate-800">{k.type}</div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(k.createdAt)}
                        </div>
                      </div>
                      <span
                        className={
                          k.granted
                            ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200'
                            : 'rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200'
                        }
                      >
                        {k.granted ? 'Onaylı' : 'Reddedildi'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Profil" />
            <CardBody className="space-y-1 text-sm text-slate-700">
              <div><span className="text-slate-500">Ad Soyad:</span> {fullName}</div>
              <div><span className="text-slate-500">E-posta:</span> {c.email}</div>
              <div><span className="text-slate-500">Telefon:</span> {c.phone ?? '—'}</div>
              <div>
                <span className="text-slate-500">Kayıt:</span> {formatDate(c.createdAt)}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Adresler" description={`${c.addresses?.length ?? 0} adres`} />
            <CardBody className="space-y-3 text-sm">
              {(c.addresses ?? []).length === 0 ? (
                <div className="text-slate-500">Adres yok.</div>
              ) : (
                c.addresses!.map((a) => (
                  <div key={a.id} className="rounded-md border border-slate-200 p-3">
                    {a.label ? (
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {a.label}
                      </div>
                    ) : null}
                    <div className="text-slate-700">
                      {a.line1}
                      {a.line2 ? (
                        <>
                          <br />
                          {a.line2}
                        </>
                      ) : null}
                      <br />
                      {[a.postalCode, a.city].filter(Boolean).join(' ')}
                      {a.country ? (
                        <>
                          <br />
                          {a.country}
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Check } from 'lucide-react';
import { cancelOrder, getOrder, updateOrderStatus } from '@/lib/queries';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  Select,
  Textarea,
} from '@/components/ui';
import { FormField } from '@/components/FormField';
import { OrderStatusPill } from '@/components/OrderStatusPill';
import {
  allowedTransitions,
  isTerminal,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@/lib/order-status';
import { formatDateTime, formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface OrderDetail {
  id: string;
  orderNumber?: string;
  status: OrderStatus;
  totalAmount?: number | string;
  currency?: string;
  subtotalAmount?: number | string;
  shippingAmount?: number | string;
  taxAmount?: number | string;
  createdAt?: string;
  customer?: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } | null;
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } | null;
  items?: {
    id: string;
    productName: string;
    variantOptions?: Record<string, string>;
    sku?: string;
    quantity: number;
    unitPrice: number | string;
    totalPrice?: number | string;
  }[];
  events?: {
    id: string;
    type: string;
    description?: string;
    createdAt: string;
  }[];
  refundRequests?: {
    id: string;
    status: string;
    reason?: string;
    createdAt: string;
    amount?: number | string;
  }[];
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();

  const orderQ = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
    enabled: !!id,
  });

  const [statusOpen, setStatusOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');

  const statusMut = useMutation({
    mutationFn: () =>
      updateOrderStatus(id, { status: nextStatus, note: note || undefined }),
    onSuccess: () => {
      toast.success('Durum güncellendi');
      qc.invalidateQueries({ queryKey: ['order', id] });
      setStatusOpen(false);
      setNote('');
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelOrder(id, { reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Sipariş iptal edildi');
      qc.invalidateQueries({ queryKey: ['order', id] });
      setCancelOpen(false);
      setReason('');
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'İptal edilemedi');
    },
  });

  if (orderQ.isLoading) return <div className="text-slate-500">Yükleniyor…</div>;
  if (orderQ.isError || !orderQ.data) {
    return <div className="text-rose-600">Sipariş yüklenemedi.</div>;
  }

  const o = orderQ.data as unknown as OrderDetail;
  const transitions = allowedTransitions(o.status);
  const terminal = isTerminal(o.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" /> Geri
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {o.orderNumber ?? o.id.slice(0, 8)}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              {formatDateTime(o.createdAt)} · <OrderStatusPill status={o.status} />
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={terminal || transitions.length === 0}
            onClick={() => {
              setNextStatus(transitions[0] ?? '');
              setStatusOpen(true);
            }}
          >
            <Check className="h-4 w-4" /> Durumu Güncelle
          </Button>
          <Button
            variant="danger"
            disabled={terminal || !transitions.includes('cancelled')}
            onClick={() => setCancelOpen(true)}
          >
            <Ban className="h-4 w-4" /> İptal Et
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Sipariş Kalemleri" />
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ürün
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      SKU
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Adet
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Birim
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Toplam
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(o.items ?? []).map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{it.productName}</div>
                        {it.variantOptions ? (
                          <div className="text-xs text-slate-500">
                            {Object.entries(it.variantOptions)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' / ')}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{it.sku ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{it.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatMoney(it.unitPrice, o.currency ?? 'TRY')}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatMoney(it.totalPrice ?? Number(it.unitPrice) * it.quantity, o.currency ?? 'TRY')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-slate-600">Ara toplam</td>
                    <td className="px-4 py-2 text-right text-slate-900">{formatMoney(o.subtotalAmount ?? 0, o.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-slate-600">Kargo</td>
                    <td className="px-4 py-2 text-right text-slate-900">{formatMoney(o.shippingAmount ?? 0, o.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-slate-600">Vergi</td>
                    <td className="px-4 py-2 text-right text-slate-900">{formatMoney(o.taxAmount ?? 0, o.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-900">Toplam</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(o.totalAmount ?? 0, o.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sipariş Zaman Çizelgesi" />
            <CardBody>
              {(o.events ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">Henüz olay yok.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                  {(o.events ?? []).map((ev) => (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[9px] top-1.5 inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
                      <div className="text-sm font-medium text-slate-800">
                        {ev.type}
                      </div>
                      {ev.description ? (
                        <div className="text-xs text-slate-500">{ev.description}</div>
                      ) : null}
                      <div className="text-xs text-slate-400">
                        {formatDateTime(ev.createdAt)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          {(o.refundRequests ?? []).length > 0 ? (
            <Card>
              <CardHeader title="İade Talepleri" />
              <CardBody className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tarih
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tutar
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Sebep
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Durum
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {o.refundRequests!.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3">{formatDateTime(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          {formatMoney(r.amount ?? 0, o.currency ?? 'TRY')}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.reason ?? '—'}</td>
                        <td className="px-4 py-3">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Müşteri" />
            <CardBody className="space-y-1 text-sm">
              <div className="font-medium text-slate-900">
                {o.customer?.name ?? o.customer?.email ?? '—'}
              </div>
              {o.customer?.email ? (
                <div className="text-slate-600">{o.customer.email}</div>
              ) : null}
              {o.customer?.phone ? (
                <div className="text-slate-600">{o.customer.phone}</div>
              ) : null}
              {o.customer ? (
                <Link
                  href={`/customers/${o.customer.id}`}
                  className="mt-1 inline-block text-xs text-brand-600 hover:underline"
                >
                  Müşteri profili →
                </Link>
              ) : null}
            </CardBody>
          </Card>
          <AddressCard title="Teslimat Adresi" addr={o.shippingAddress} />
          <AddressCard title="Fatura Adresi" addr={o.billingAddress} />
        </div>
      </div>

      <Dialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Sipariş durumunu güncelle"
        description={`Mevcut: ${ORDER_STATUS_LABELS[o.status]}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!nextStatus}
              loading={statusMut.isPending}
              onClick={() => statusMut.mutate()}
            >
              Güncelle
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Yeni durum" required>
            <Select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
            >
              <option value="">Seçin</option>
              {transitions.map((t) => (
                <option key={t} value={t}>
                  {ORDER_STATUS_LABELS[t]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Not (opsiyonel)">
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Müşteriyi bilgilendirecek açıklama…"
            />
          </FormField>
        </div>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Siparişi iptal et"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              loading={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              İptal Et
            </Button>
          </>
        }
      >
        <FormField label="İptal sebebi">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Müşterinin isteği, stokta yok, vs."
          />
        </FormField>
      </Dialog>
    </div>
  );
}

function AddressCard({
  title,
  addr,
}: {
  title: string;
  addr: OrderDetail['shippingAddress'];
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="text-sm text-slate-700">
        {addr ? (
          <address className="not-italic">
            {addr.line1}
            {addr.line2 ? (
              <>
                <br />
                {addr.line2}
              </>
            ) : null}
            <br />
            {[addr.postalCode, addr.city, addr.state].filter(Boolean).join(' ')}
            {addr.country ? (
              <>
                <br />
                {addr.country}
              </>
            ) : null}
          </address>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </CardBody>
    </Card>
  );
}

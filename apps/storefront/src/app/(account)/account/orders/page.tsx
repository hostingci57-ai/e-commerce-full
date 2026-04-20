'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/Button';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { RefundRequestModal } from '@/components/RefundRequestModal';
import { Spinner } from '@/components/Spinner';
import { formatDate, formatPrice } from '@/lib/format';
import type { OrderSummary, Paginated } from '@/lib/types';

const REFUND_ELIGIBLE = new Set([
  'payment_success',
  'preparing',
  'shipped',
  'delivered',
  'partial_refunded',
]);

export default function OrdersPage() {
  const [data, setData] = useState<Paginated<OrderSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.orders.me();
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error && 'status' in (e as object)
              ? 'Once giris yapmalisiniz'
              : 'Siparisler yuklenemedi',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        {error}{' '}
        <Link href="/login" className="text-brand-700 hover:underline">
          Giris Yap
        </Link>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Henuz siparisiniz yok.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.items.map((o) => (
        <div
          key={o.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div>
            <p className="text-sm text-slate-500">
              {formatDate(o.createdAt)}
            </p>
            <p className="font-semibold text-slate-900">
              Siparis #{o.orderNumber}
            </p>
            <p className="text-sm text-slate-600">{o.itemCount} urun</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <OrderStatusBadge status={o.status} />
            <span className="font-semibold">
              {formatPrice(o.total, o.currency)}
            </span>
            {REFUND_ELIGIBLE.has(o.status) ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRefundOrderId(o.id)}
              >
                Iade Talebi Olustur
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      {refundOrderId ? (
        <RefundRequestModal
          orderId={refundOrderId}
          onClose={() => setRefundOrderId(null)}
          onSuccess={() => {
            // refetch
            void (async () => {
              const res = await api.orders.me();
              setData(res);
            })();
          }}
        />
      ) : null}
    </div>
  );
}

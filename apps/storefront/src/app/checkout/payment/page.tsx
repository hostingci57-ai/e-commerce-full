'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { Button } from '@/components/Button';
import { OrderSummary } from '@/components/OrderSummary';
import { useCart } from '@/lib/cart-context';

export default function PaymentStepPage() {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const [method, setMethod] = useState<'cod' | 'stub_card' | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalize = async () => {
    const token =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('checkout_token')
        : null;
    if (!token || !method) {
      setError('Odeme yontemini secin.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.checkout.setPayment(token, method);
      const result = await api.checkout.complete(token);
      sessionStorage.removeItem('checkout_token');
      await refresh().catch(() => null);
      router.push(
        `/checkout/thank-you?orderNumber=${encodeURIComponent(result.orderNumber)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Siparis olusturulamadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-4 text-xl font-semibold">Odeme Yontemi</h2>
        <PaymentMethodSelector value={method} onChange={setMethod} />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={finalize}
            loading={loading}
            disabled={!method}
            size="lg"
          >
            Siparisi Tamamla
          </Button>
        </div>
      </div>
      <div>{cart ? <OrderSummary totals={cart.totals} /> : null}</div>
    </div>
  );
}

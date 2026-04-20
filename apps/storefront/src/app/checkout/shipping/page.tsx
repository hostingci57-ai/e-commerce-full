'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { ShippingMethodSelector } from '@/components/ShippingMethodSelector';
import { Button } from '@/components/Button';
import { OrderSummary } from '@/components/OrderSummary';
import { useCart } from '@/lib/cart-context';
import type { ShippingMethod } from '@/lib/types';

export default function ShippingStepPage() {
  const router = useRouter();
  const { cart } = useCart();
  const [method, setMethod] = useState<ShippingMethod['code'] | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    const token =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('checkout_token')
        : null;
    if (!token || !method) {
      setError('Checkout oturumu bulunamadi — once adres girin.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.checkout.setShipping(token, method);
      router.push('/checkout/payment');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-4 text-xl font-semibold">Kargo Secimi</h2>
        <ShippingMethodSelector
          value={method}
          onChange={setMethod}
          currency={cart?.totals.currency}
        />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={next}
            loading={loading}
            disabled={!method}
            size="lg"
          >
            Devam: Odeme
          </Button>
        </div>
      </div>
      <div>{cart ? <OrderSummary totals={cart.totals} /> : null}</div>
    </div>
  );
}

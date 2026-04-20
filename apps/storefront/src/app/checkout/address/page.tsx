'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AddressForm } from '@/components/AddressForm';
import { OrderSummary } from '@/components/OrderSummary';
import { Spinner } from '@/components/Spinner';
import { useCart } from '@/lib/cart-context';
import type { Address } from '@/lib/types';

export default function AddressStepPage() {
  const router = useRouter();
  const { cart } = useCart();
  const [token, setToken] = useState<string | null>(null);
  const [initial, setInitial] = useState<Partial<Address> | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('checkout_token')
            : null;
        let session = null;
        if (saved) {
          session = await api.checkout.get(saved).catch(() => null);
        }
        if (!session) {
          session = await api.checkout.start();
          if (typeof window !== 'undefined' && session?.token) {
            sessionStorage.setItem('checkout_token', session.token);
          }
        }
        if (!cancelled && session) {
          setToken(session.token);
          setInitial(session.address);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (a: Address) => {
    if (!token) return;
    await api.checkout.setAddress(token, a);
    router.push('/checkout/shipping');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-4 text-xl font-semibold">Teslimat Adresi</h2>
        <AddressForm initial={initial} onSubmit={onSubmit} submitLabel="Devam: Kargo" />
      </div>
      <div>{cart ? <OrderSummary totals={cart.totals} /> : null}</div>
    </div>
  );
}

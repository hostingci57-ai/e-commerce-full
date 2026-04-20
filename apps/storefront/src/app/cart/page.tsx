'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { CartLineItem } from '@/components/CartLineItem';
import { OrderSummary } from '@/components/OrderSummary';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Spinner } from '@/components/Spinner';

export default function CartPage() {
  const { cart, loading, applyCoupon, removeCoupon } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  if (loading && !cart) {
    return (
      <div className="container flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="container py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Sepet bos</h1>
        <p className="mb-6 text-slate-600">
          Sepetinize henuz urun eklemediniz.
        </p>
        <Link href="/products">
          <Button size="lg">Urunleri Incele</Button>
        </Link>
      </div>
    );
  }

  const onApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      await applyCoupon(couponCode.trim());
      setCouponCode('');
    } catch (e) {
      setCouponError(
        e instanceof Error ? 'Kupon uygulanamadi' : 'Kupon uygulanamadi',
      );
    } finally {
      setCouponBusy(false);
    }
  };

  const currency = cart.totals.currency;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">Sepet</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {cart.lines.map((line) => (
              <CartLineItem key={line.variantId} line={line} currency={currency} />
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Indirim Kuponu</h3>
            {cart.couponCode ? (
              <div className="flex items-center justify-between text-sm">
                <span>
                  Uygulanan kupon:{' '}
                  <strong className="text-emerald-700">{cart.couponCode}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => removeCoupon(cart.couponCode!)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Kaldir
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Kupon kodu"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    error={couponError}
                  />
                </div>
                <Button onClick={onApplyCoupon} loading={couponBusy}>
                  Uygula
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <OrderSummary totals={cart.totals} />
          <Link href="/checkout/address" className="block">
            <Button className="w-full" size="lg">
              Odemeye Gec
            </Button>
          </Link>
          <Link
            href="/products"
            className="block text-center text-sm text-brand-700 hover:underline"
          >
            Alisverise Devam Et
          </Link>
        </div>
      </div>
    </div>
  );
}

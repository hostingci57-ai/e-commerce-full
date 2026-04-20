'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';

export default function ThankYouPage() {
  const params = useSearchParams();
  const orderNumber = params.get('orderNumber');

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
        ✓
      </div>
      <h1 className="text-3xl font-bold text-slate-900">Siparisiniz alindi!</h1>
      {orderNumber ? (
        <p className="text-slate-600">
          Siparis numaraniz: <strong className="text-slate-900">{orderNumber}</strong>
        </p>
      ) : (
        <p className="text-slate-600">
          Siparisiniz basariyla olusturuldu.
        </p>
      )}
      <div className="mt-4 flex gap-3">
        <Link href="/account/orders">
          <Button variant="secondary">Siparislerim</Button>
        </Link>
        <Link href="/products">
          <Button>Alisverise Devam Et</Button>
        </Link>
      </div>
    </div>
  );
}

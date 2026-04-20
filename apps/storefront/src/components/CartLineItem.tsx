'use client';

import Link from 'next/link';
import { useState } from 'react';
import { QuantityStepper } from './QuantityStepper';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import type { CartLine } from '@/lib/types';

export function CartLineItem({
  line,
  currency,
}: {
  line: CartLine;
  currency: string;
}) {
  const { updateItem, removeItem } = useCart();
  const [busy, setBusy] = useState(false);

  const setQty = async (q: number) => {
    if (q === line.quantity) return;
    setBusy(true);
    try {
      await updateItem(line.variantId, q);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeItem(line.variantId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-4 border-b border-slate-200 py-4 last:border-b-0">
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-slate-100">
        {line.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.image} alt={line.productName} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <Link
          href={`/products/${line.productSlug}`}
          className="text-sm font-medium text-slate-900 hover:text-brand-700"
        >
          {line.productName}
        </Link>
        {line.variantName ? (
          <span className="text-xs text-slate-500">{line.variantName}</span>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          <QuantityStepper value={line.quantity} onChange={setQty} disabled={busy} />
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-xs text-red-600 hover:underline disabled:opacity-40"
          >
            Kaldir
          </button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        <span className="text-sm font-semibold text-slate-900">
          {formatPrice(line.lineTotal, currency)}
        </span>
        <span className="text-xs text-slate-500">
          {formatPrice(line.unitPrice, currency)} / adet
        </span>
      </div>
    </div>
  );
}

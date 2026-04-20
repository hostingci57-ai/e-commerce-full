'use client';

import { clsx } from 'clsx';
import { formatPrice } from '@/lib/format';
import type { ShippingMethod } from '@/lib/types';

const METHODS: ShippingMethod[] = [
  { code: 'standard', label: 'Standart Kargo', price: 4999, etaDays: 3 },
  { code: 'express', label: 'Ekspres Kargo', price: 9999, etaDays: 1 },
];

interface Props {
  value?: ShippingMethod['code'];
  onChange: (code: ShippingMethod['code']) => void;
  currency?: string;
}

export function ShippingMethodSelector({ value, onChange, currency = 'TRY' }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {METHODS.map((m) => {
        const selected = value === m.code;
        return (
          <button
            type="button"
            key={m.code}
            onClick={() => onChange(m.code)}
            className={clsx(
              'flex items-center justify-between rounded-md border p-4 text-left transition',
              selected
                ? 'border-brand-600 bg-brand-50'
                : 'border-slate-300 hover:border-brand-500',
            )}
          >
            <div>
              <p className="font-medium text-slate-900">{m.label}</p>
              <p className="text-sm text-slate-600">
                Tahmini teslim: {m.etaDays} gun
              </p>
            </div>
            <span className="font-semibold">{formatPrice(m.price, currency)}</span>
          </button>
        );
      })}
    </div>
  );
}

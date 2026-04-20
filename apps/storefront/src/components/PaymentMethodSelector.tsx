'use client';

import { clsx } from 'clsx';

interface Props {
  value?: 'cod' | 'stub_card';
  onChange: (v: 'cod' | 'stub_card') => void;
}

export function PaymentMethodSelector({ value, onChange }: Props) {
  const options: { code: 'cod' | 'stub_card'; label: string; desc: string }[] = [
    {
      code: 'cod',
      label: 'Kapida Odeme',
      desc: 'Siparisiniz teslim edildiginde odeme yapin.',
    },
    {
      code: 'stub_card',
      label: 'Kredi Karti (Stub)',
      desc: 'Simulasyon — gercek odeme alinmaz.',
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      {options.map((o) => {
        const selected = value === o.code;
        return (
          <button
            type="button"
            key={o.code}
            onClick={() => onChange(o.code)}
            className={clsx(
              'rounded-md border p-4 text-left transition',
              selected
                ? 'border-brand-600 bg-brand-50'
                : 'border-slate-300 hover:border-brand-500',
            )}
          >
            <p className="font-medium text-slate-900">{o.label}</p>
            <p className="text-sm text-slate-600">{o.desc}</p>
          </button>
        );
      })}
    </div>
  );
}

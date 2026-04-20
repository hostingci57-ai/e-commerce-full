'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import type { ProductVariant } from '@/lib/types';

interface Props {
  variants: ProductVariant[];
  value: ProductVariant | null;
  onChange: (variant: ProductVariant) => void;
}

export function VariantSelector({ variants, value, onChange }: Props) {
  const optionGroups = useMemo(() => {
    const groups: Record<string, Set<string>> = {};
    for (const v of variants) {
      for (const [k, val] of Object.entries(v.options ?? {})) {
        if (!groups[k]) groups[k] = new Set();
        groups[k].add(val);
      }
    }
    return Object.entries(groups).map(([name, vals]) => ({
      name,
      values: Array.from(vals),
    }));
  }, [variants]);

  if (!optionGroups.length || variants.length <= 1) return null;

  const selectOption = (groupName: string, optionValue: string) => {
    const current = value?.options ?? {};
    const candidate = variants.find((v) => {
      if (v.options?.[groupName] !== optionValue) return false;
      for (const [k, val] of Object.entries(current)) {
        if (k === groupName) continue;
        if (v.options?.[k] !== val) return false;
      }
      return true;
    });
    if (candidate) onChange(candidate);
    else {
      // fallback: any variant matching this value
      const fallback = variants.find(
        (v) => v.options?.[groupName] === optionValue,
      );
      if (fallback) onChange(fallback);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {optionGroups.map((group) => (
        <div key={group.name} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">
            {group.name}
          </span>
          <div className="flex flex-wrap gap-2">
            {group.values.map((val) => {
              const selected = value?.options?.[group.name] === val;
              return (
                <button
                  type="button"
                  key={val}
                  onClick={() => selectOption(group.name, val)}
                  className={clsx(
                    'rounded-md border px-3 py-1.5 text-sm transition',
                    selected
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-300 hover:border-brand-500',
                  )}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

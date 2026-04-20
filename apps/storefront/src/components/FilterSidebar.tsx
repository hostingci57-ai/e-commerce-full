'use client';

import { useState } from 'react';
import type { Brand, Category } from '@/lib/types';

export interface FilterState {
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

interface Props {
  categories?: Category[];
  brands?: Brand[];
  value: FilterState;
  onChange: (next: FilterState) => void;
}

export function FilterSidebar({ categories, brands, value, onChange }: Props) {
  const [local, setLocal] = useState<FilterState>(value);

  const apply = (next: Partial<FilterState>) => {
    const merged = { ...local, ...next };
    setLocal(merged);
    onChange(merged);
  };

  return (
    <aside className="flex w-full flex-col gap-6 rounded-lg border border-slate-200 bg-white p-4 lg:w-64">
      {categories?.length ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            Kategoriler
          </h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {categories.slice(0, 10).map((c) => (
              <li key={c.id}>
                <a
                  href={`/c/${c.slug}`}
                  className="hover:text-brand-700"
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brands?.length ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Marka</h3>
          <select
            value={local.brand ?? ''}
            onChange={(e) =>
              apply({ brand: e.target.value || undefined })
            }
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Tumu</option>
            {brands.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Fiyat</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={local.minPrice ?? ''}
            onChange={(e) =>
              apply({
                minPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-slate-400">—</span>
          <input
            type="number"
            placeholder="Max"
            value={local.maxPrice ?? ''}
            onChange={(e) =>
              apply({
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </section>

      <section>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!!local.inStock}
            onChange={(e) => apply({ inStock: e.target.checked || undefined })}
          />
          Sadece stokta olanlar
        </label>
      </section>
    </aside>
  );
}

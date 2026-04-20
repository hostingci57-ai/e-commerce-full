'use client';

import { Select } from './Select';
import type { ProductListQuery } from '@/lib/types';

type Sort = NonNullable<ProductListQuery['sort']>;

interface Props {
  value: Sort;
  onChange: (v: Sort) => void;
}

export function SortDropdown({ value, onChange }: Props) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as Sort)}
      aria-label="Siralama"
    >
      <option value="newest">En Yeni</option>
      <option value="price_asc">Fiyat: Dusuk → Yuksek</option>
      <option value="price_desc">Fiyat: Yuksek → Dusuk</option>
      <option value="popular">En Populer</option>
    </Select>
  );
}

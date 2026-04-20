'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type {
  Brand,
  Category,
  Paginated,
  ProductListQuery,
  ProductSummary,
} from '@/lib/types';
import { ProductGrid } from '@/components/ProductGrid';
import { FilterSidebar, type FilterState } from '@/components/FilterSidebar';
import { SortDropdown } from '@/components/SortDropdown';
import { Pagination } from '@/components/Pagination';
import { Spinner } from '@/components/Spinner';

interface Props {
  initialData: Paginated<ProductSummary>;
  categories: Category[];
  brands: Brand[];
  categorySlug?: string;
}

/**
 * PLP client shell. SSR provides the first page; interactions (filter,
 * sort, pagination) stay fully client-side — URL never changes (per the
 * SSR-first convention).
 */
export function ProductListClient({
  initialData,
  categories,
  brands,
  categorySlug,
}: Props) {
  const [page, setPage] = useState(initialData.page ?? 1);
  const [sort, setSort] =
    useState<NonNullable<ProductListQuery['sort']>>('newest');
  const [filters, setFilters] = useState<FilterState>({});
  const [data, setData] = useState<Paginated<ProductSummary>>(initialData);
  const [loading, setLoading] = useState(false);
  const [firstRender, setFirstRender] = useState(true);

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q: ProductListQuery = {
      page,
      pageSize: 24,
      sort,
      category: categorySlug ?? undefined,
      brand: filters.brand,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      inStock: filters.inStock,
    };
    api.products
      .list(q)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled)
          setData({
            items: [],
            total: 0,
            page: 1,
            pageSize: 24,
            hasMore: false,
          });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, filters, categorySlug]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <FilterSidebar
        categories={categories}
        brands={brands}
        value={filters}
        onChange={(v) => {
          setPage(1);
          setFilters(v);
        }}
      />
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-slate-600">
            {data.total} urun bulundu
          </span>
          <SortDropdown
            value={sort}
            onChange={(v) => {
              setPage(1);
              setSort(v);
            }}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <ProductGrid products={data.items} />
        )}
        <Pagination
          page={page}
          pageSize={data.pageSize ?? 24}
          total={data.total ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  );
}

import { api } from '@/lib/api';
import { getTenantSlug } from '@/lib/tenant-context';
import { ProductListClient } from './ProductListClient';
import type { Brand, Category, ProductSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tum Urunler',
  description: 'Kategoriler, markalar ve fiyata gore urunleri filtreleyin.',
};

export default async function ProductsPage() {
  const tenantSlug = await getTenantSlug();

  const [products, categories, brands] = await Promise.all([
    api.products
      .list({ page: 1, pageSize: 24, sort: 'newest' }, { tenantSlug })
      .catch(() => ({
        items: [] as ProductSummary[],
        total: 0,
        page: 1,
        pageSize: 24,
        hasMore: false,
      })),
    api.categories.tree({ tenantSlug }).catch(() => [] as Category[]),
    api.brands.list({ tenantSlug }).catch(() => [] as Brand[]),
  ]);

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">Tum Urunler</h1>
      <ProductListClient
        initialData={products}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}

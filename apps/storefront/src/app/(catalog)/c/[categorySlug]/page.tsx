import { api } from '@/lib/api';
import { getTenantSlug } from '@/lib/tenant-context';
import { ProductListClient } from '../../products/ProductListClient';
import type { Brand, Category, ProductSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  categorySlug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { categorySlug } = await params;
  return {
    title: categorySlug.replace(/-/g, ' '),
    description: `${categorySlug} kategorisindeki urunler`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { categorySlug } = await params;
  const tenantSlug = await getTenantSlug();

  const [products, categories, brands] = await Promise.all([
    api.products
      .list(
        { page: 1, pageSize: 24, category: categorySlug, sort: 'newest' },
        { tenantSlug },
      )
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

  const siteUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Anasayfa', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Ürünler', item: `${siteUrl}/products` },
      {
        '@type': 'ListItem',
        position: 3,
        name: categorySlug.replace(/-/g, ' '),
        item: `${siteUrl}/c/${categorySlug}`,
      },
    ],
  };

  return (
    <div className="container py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <h1 className="mb-6 text-3xl font-bold capitalize text-slate-900">
        {categorySlug.replace(/-/g, ' ')}
      </h1>
      <ProductListClient
        initialData={products}
        categories={categories}
        brands={brands}
        categorySlug={categorySlug}
      />
    </div>
  );
}

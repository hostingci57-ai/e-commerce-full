import Link from 'next/link';
import { api } from '@/lib/api';
import { getTenantSlug } from '@/lib/tenant-context';
import { ProductGrid } from '@/components/ProductGrid';
import type { Category, ProductSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const tenantSlug = await getTenantSlug();
  const [products, categories] = await Promise.all([
    api.products
      .list({ page: 1, pageSize: 8, sort: 'newest' }, { tenantSlug })
      .catch(() => ({ items: [] as ProductSummary[], total: 0, page: 1, pageSize: 8, hasMore: false })),
    api.categories.tree({ tenantSlug }).catch(() => [] as Category[]),
  ]);

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-50 via-white to-slate-50 py-16">
        <div className="container flex flex-col items-start gap-6">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Kaliteli urunler,{' '}
            <span className="text-brand-600">hizli teslimat</span>.
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Binlerce urun, guvenli odeme, kolay iade. Alisverise bugun baslayin.
          </p>
          <Link
            href="/products"
            className="rounded-md bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
          >
            Urunleri Kesfet
          </Link>
        </div>
      </section>

      {categories.length ? (
        <section className="container py-12">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">
            One Cikan Kategoriler
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {categories.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Yeni Urunler</h2>
          <Link
            href="/products"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Tumunu Gor →
          </Link>
        </div>
        <ProductGrid products={products.items} />
      </section>
    </div>
  );
}

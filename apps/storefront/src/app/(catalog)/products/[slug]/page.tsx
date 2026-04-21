import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { getTenantSlug } from '@/lib/tenant-context';
import { ProductGallery } from '@/components/ProductGallery';
import { formatPrice } from '@/lib/format';
import { WishlistButton } from '@/components/WishlistButton';
import { ProductDetailClient } from './ProductDetailClient';
import { ProductReviews } from './ProductReviews';

export const dynamic = 'force-dynamic';

interface Params {
  slug: string;
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { slug } = await params;
  const tenantSlug = await getTenantSlug();
  try {
    const product = await api.products.get(slug, { tenantSlug });
    return {
      title: product.name,
      description: product.description?.slice(0, 160) ?? product.name,
      openGraph: {
        title: product.name,
        description: product.description?.slice(0, 160) ?? product.name,
        images: product.image ? [{ url: product.image.url }] : undefined,
      },
    };
  } catch {
    return { title: 'Urun' };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const tenantSlug = await getTenantSlug();
  const product = await api.products.get(slug, { tenantSlug }).catch(() => null);
  if (!product) notFound();

  const siteUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? product.name,
    image:
      product.images?.map((i) => i.url).filter(Boolean) ??
      (product.image ? [product.image.url] : []),
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/products/${product.slug}`,
      priceCurrency: product.currency ?? 'TRY',
      price: typeof product.price === 'number' ? product.price : Number(product.price),
      availability:
        (product as unknown as { availableStock?: number }).availableStock &&
        (product as unknown as { availableStock: number }).availableStock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
    },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Anasayfa', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Ürünler', item: `${siteUrl}/products` },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: `${siteUrl}/products/${product.slug}`,
      },
    ],
  };

  return (
    <div className="container py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images ?? []} name={product.name} />

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {product.brand ? (
                <span className="text-sm font-medium text-slate-500">
                  {product.brand.name}
                </span>
              ) : null}
              <h1 className="mt-1 text-3xl font-bold text-slate-900">{product.name}</h1>
            </div>
            <WishlistButton productId={product.id} />
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-slate-900">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price ? (
              <span className="text-sm text-slate-400 line-through">
                {formatPrice(product.compareAtPrice, product.currency)}
              </span>
            ) : null}
          </div>

          <ProductDetailClient product={product} />

          {product.description ? (
            <details className="mt-6 rounded-md border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 font-medium">
                Urun Aciklamasi
              </summary>
              <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                {product.description}
              </div>
            </details>
          ) : null}
        </div>
      </div>

      <section className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="mb-4 text-2xl font-semibold text-slate-900">
          Müşteri Yorumları
        </h2>
        <ProductReviews productId={product.id} />
      </section>
    </div>
  );
}

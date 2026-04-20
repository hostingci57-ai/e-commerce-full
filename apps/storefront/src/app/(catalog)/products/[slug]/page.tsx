import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { getTenantSlug } from '@/lib/tenant-context';
import { ProductGallery } from '@/components/ProductGallery';
import { formatPrice } from '@/lib/format';
import { ProductDetailClient } from './ProductDetailClient';

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

  return (
    <div className="container py-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images ?? []} name={product.name} />

        <div className="flex flex-col gap-4">
          {product.brand ? (
            <span className="text-sm font-medium text-slate-500">
              {product.brand.name}
            </span>
          ) : null}
          <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>

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
    </div>
  );
}

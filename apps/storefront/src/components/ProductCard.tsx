import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import type { ProductSummary } from '@/lib/types';
import { WishlistButton } from './WishlistButton';

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-brand-500 hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-slate-100">
        {product.image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image.url}
            alt={product.image.alt ?? product.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Gorsel Yok
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute right-3 top-3">
        <div className="pointer-events-auto">
          <WishlistButton productId={product.id} size="sm" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand ? (
          <span className="text-xs text-slate-500">{product.brand.name}</span>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-brand-700">
          {product.name}
        </h3>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-base font-semibold text-slate-900">
            {formatPrice(product.price, product.currency)}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <span className="text-xs text-slate-400 line-through">
              {formatPrice(product.compareAtPrice, product.currency)}
            </span>
          ) : null}
        </div>
        {!product.inStock ? (
          <span className="text-xs font-medium text-red-600">Stokta Yok</span>
        ) : null}
      </div>
    </Link>
  );
}

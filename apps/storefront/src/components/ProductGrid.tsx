import type { ProductSummary } from '@/lib/types';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  if (!products.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Urun bulunamadi.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

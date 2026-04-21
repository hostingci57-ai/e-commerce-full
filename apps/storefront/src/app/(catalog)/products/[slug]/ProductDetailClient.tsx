'use client';

import { useMemo, useState } from 'react';
import type { Product, ProductVariant } from '@/lib/types';
import { VariantSelector } from '@/components/VariantSelector';
import { QuantityStepper } from '@/components/QuantityStepper';
import { AddToCartButton } from '@/components/AddToCartButton';

export function ProductDetailClient({ product }: { product: Product }) {
  const variants: ProductVariant[] = product.variants ?? [];
  const [variant, setVariant] = useState<ProductVariant | null>(
    variants.find((v) => v.stock > 0) ?? variants[0] ?? null,
  );
  const [quantity, setQuantity] = useState(1);

  const stock = variant?.stock ?? 0;
  const inStock = stock > 0;

  const stockText = useMemo(() => {
    if (!variant) return null;
    if (stock <= 0) return { text: 'Tükendi', tone: 'text-red-600' };
    if (stock <= 10)
      return { text: `Son ${stock} adet`, tone: 'text-amber-700' };
    return { text: 'Stokta var', tone: 'text-emerald-700' };
  }, [variant, stock]);

  return (
    <div className="flex flex-col gap-5">
      {variants.length > 1 ? (
        <VariantSelector
          variants={variants}
          value={variant}
          onChange={(v) => {
            setVariant(v);
            setQuantity(1);
          }}
        />
      ) : null}

      {stockText ? (
        <p className={`text-sm font-medium ${stockText.tone}`}>
          {stockText.text}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-700">Adet</span>
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          max={Math.max(1, Math.min(stock || 99, 99))}
          disabled={!inStock}
        />
      </div>

      {variant ? (
        <AddToCartButton
          variantId={variant.id}
          quantity={quantity}
          disabled={!inStock}
          label={inStock ? 'Sepete Ekle' : 'Tükendi'}
        />
      ) : null}
    </div>
  );
}

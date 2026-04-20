'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import {
  createProduct,
  listBrands,
  listCategories,
  upsertVariants,
  type BrandListItem,
  type CategoryListItem,
  type PaginatedResponse,
} from '@/lib/queries';
import { ProductForm } from '@/components/ProductForm';
import { Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function NewProductPage() {
  const router = useRouter();

  const brandsQ = useQuery({ queryKey: ['brands'], queryFn: listBrands });
  const categoriesQ = useQuery({ queryKey: ['categories', 'list'], queryFn: listCategories });

  const brands = normalizeList<BrandListItem>(brandsQ.data);
  const categories = normalizeList<CategoryListItem>(categoriesQ.data).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Geri
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Yeni Ürün</h1>
          <p className="mt-1 text-sm text-slate-500">Ürün bilgilerini girin ve yayınlayın.</p>
        </div>
      </div>
      <ProductForm
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        categories={categories}
        submitLabel="Ürünü Oluştur"
        onSubmit={async ({ values, basePriceKurus, variantRows }) => {
          const created = (await createProduct({
            name: values.name,
            slug: values.slug,
            description: values.description || undefined,
            brandId: values.brandId || undefined,
            categoryIds: values.categoryIds,
            status: values.status,
            basePrice: basePriceKurus,
            images: values.images,
            seo: {
              title: values.seoTitle || undefined,
              description: values.seoDescription || undefined,
              ogImage: values.ogImage || undefined,
            },
          })) as { id: string };

          if (variantRows.length > 0 && created?.id) {
            try {
              await upsertVariants(created.id, {
                variants: variantRows.map((r) => ({
                  sku: r.sku || undefined,
                  options: r.combination,
                  price: r.priceKurus,
                  stock: r.stock,
                })),
              });
            } catch {
              // Non-fatal — main product is created.
            }
          }

          toast.success('Ürün oluşturuldu');
          router.push(`/products/${created.id}`);
        }}
      />
    </div>
  );
}

function normalizeList<T>(raw: T[] | PaginatedResponse<T> | undefined): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.items ?? [];
}

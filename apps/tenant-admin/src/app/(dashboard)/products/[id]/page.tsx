'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Trash2 } from 'lucide-react';
import {
  deleteProduct,
  getProduct,
  listBrands,
  listCategories,
  updateProduct,
  upsertVariants,
  type BrandListItem,
  type CategoryListItem,
  type PaginatedResponse,
} from '@/lib/queries';
import { ProductForm } from '@/components/ProductForm';
import { Button, Dialog } from '@/components/ui';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const productQ = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    enabled: !!id,
  });
  const brandsQ = useQuery({ queryKey: ['brands'], queryFn: listBrands });
  const categoriesQ = useQuery({ queryKey: ['categories', 'list'], queryFn: listCategories });

  const brands = normalizeList<BrandListItem>(brandsQ.data);
  const categories = normalizeList<CategoryListItem>(categoriesQ.data).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  if (productQ.isLoading) {
    return <div className="text-slate-500">Yükleniyor…</div>;
  }
  if (productQ.isError || !productQ.data) {
    return <div className="text-rose-600">Ürün yüklenemedi.</div>;
  }

  const product = productQ.data as {
    id: string;
    name: string;
    slug: string;
    description?: string;
    status: 'draft' | 'active' | 'archived';
    basePrice?: number | string;
    brandId?: string | null;
    images?: string[];
    seo?: { title?: string; description?: string; ogImage?: string };
    categories?: { id: string }[];
    variants?: {
      sku?: string;
      options?: Record<string, string>;
      price?: number;
      stock?: number;
    }[];
  };

  const defaultValues = {
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    status: product.status === 'archived' ? 'draft' : product.status,
    brandId: product.brandId ?? '',
    categoryIds: (product.categories ?? []).map((c) => c.id),
    images: product.images ?? [],
    seoTitle: product.seo?.title ?? '',
    seoDescription: product.seo?.description ?? '',
    ogImage: product.seo?.ogImage ?? '',
    basePriceTry: product.basePrice
      ? (Number(product.basePrice) / 100).toFixed(2)
      : '',
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProduct(id);
      toast.success('Ürün arşivlendi');
      router.push('/products');
    } catch {
      toast.error('Silinemedi');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" /> Geri
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              /{product.slug} · {formatMoney(product.basePrice ?? 0)}
            </p>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" /> Arşivle
        </Button>
      </div>

      <ProductForm
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        categories={categories}
        defaultValues={defaultValues}
        submitLabel="Değişiklikleri Kaydet"
        onSubmit={async ({ values, basePriceKurus, variantRows }) => {
          await updateProduct(id, {
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
          });

          if (variantRows.length > 0) {
            try {
              await upsertVariants(id, {
                variants: variantRows.map((r) => ({
                  sku: r.sku || undefined,
                  options: r.combination,
                  price: r.priceKurus,
                  stock: r.stock,
                })),
              });
            } catch {
              /* non-fatal */
            }
          }

          toast.success('Ürün güncellendi');
        }}
      />

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Ürünü arşivle"
        description="Ürün satışa kapatılacak ve listelenmeyecek. Bu işlem geri alınabilir."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Vazgeç
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Arşivle
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-medium">{product.name}</span> arşivlenecek.
        </p>
      </Dialog>
    </div>
  );
}

function normalizeList<T>(raw: T[] | PaginatedResponse<T> | undefined): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.items ?? [];
}

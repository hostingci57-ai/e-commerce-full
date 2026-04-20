'use client';

import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  ProductFormSchema,
  type ProductFormValues,
} from '@/lib/schemas/product';
import { parseTryToKurus, slugify } from '@/lib/format';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';
import { FormField } from '@/components/FormField';
import {
  VariantBuilder,
  type VariantOption,
  type VariantRow,
} from '@/components/VariantBuilder';
import { ApiError } from '@/lib/api';

export interface ProductFormBrandOption {
  id: string;
  name: string;
}

export interface ProductFormCategoryOption {
  id: string;
  name: string;
}

export interface ProductSubmitPayload {
  values: ProductFormValues;
  basePriceKurus: number;
  variantOptions: VariantOption[];
  variantRows: {
    combination: Record<string, string>;
    sku: string;
    priceKurus: number;
    stock: number;
  }[];
}

interface ProductFormProps {
  brands: ProductFormBrandOption[];
  categories: ProductFormCategoryOption[];
  defaultValues?: Partial<ProductFormValues>;
  defaultVariantOptions?: VariantOption[];
  defaultVariantRows?: VariantRow[];
  submitLabel?: string;
  onSubmit: (payload: ProductSubmitPayload) => Promise<void>;
}

export function ProductForm({
  brands,
  categories,
  defaultValues,
  defaultVariantOptions,
  defaultVariantRows,
  submitLabel = 'Kaydet',
  onSubmit,
}: ProductFormProps) {
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>(
    defaultVariantOptions ?? [],
  );
  const [variantRows, setVariantRows] = useState<VariantRow[]>(
    defaultVariantRows ?? [],
  );
  const [imageInput, setImageInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      brandId: '',
      categoryIds: [],
      status: 'draft',
      seoTitle: '',
      seoDescription: '',
      ogImage: '',
      images: [],
      basePriceTry: '',
      ...defaultValues,
    },
  });

  const images = watch('images');
  const categoryIds = watch('categoryIds');
  const nameVal = watch('name');
  const slugVal = watch('slug');
  const basePriceTry = watch('basePriceTry');

  useEffect(() => {
    if (!slugVal && nameVal) {
      setValue('slug', slugify(nameVal));
    }
  }, [nameVal, slugVal, setValue]);

  const addImage = () => {
    const url = imageInput.trim();
    if (!url) return;
    setValue('images', [...(images ?? []), url], { shouldDirty: true });
    setImageInput('');
  };

  const removeImage = (idx: number) => {
    setValue(
      'images',
      (images ?? []).filter((_, i) => i !== idx),
      { shouldDirty: true },
    );
  };

  const toggleCategory = (id: string) => {
    const cur = categoryIds ?? [];
    setValue(
      'categoryIds',
      cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id],
      { shouldDirty: true },
    );
  };

  const submitHandler: SubmitHandler<ProductFormValues> = async (values) => {
    setSubmitting(true);
    try {
      await onSubmit({
        values,
        basePriceKurus: parseTryToKurus(values.basePriceTry),
        variantOptions,
        variantRows: variantRows.map((r) => ({
          combination: r.combination,
          sku: r.sku,
          priceKurus: r.priceTry ? parseTryToKurus(r.priceTry) : parseTryToKurus(values.basePriceTry),
          stock: r.stock,
        })),
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Kaydedilemedi';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Genel</TabsTrigger>
          <TabsTrigger value="media">Medya</TabsTrigger>
          <TabsTrigger value="pricing">Fiyat & Varyant</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader title="Ürün Bilgileri" />
              <CardBody className="space-y-4">
                <FormField label="Ürün adı" htmlFor="name" required error={errors.name?.message}>
                  <Input id="name" invalid={!!errors.name} {...register('name')} />
                </FormField>
                <FormField label="Slug" htmlFor="slug" required error={errors.slug?.message}>
                  <Input id="slug" invalid={!!errors.slug} {...register('slug')} />
                </FormField>
                <FormField label="Açıklama" htmlFor="description" error={errors.description?.message}>
                  <Textarea
                    id="description"
                    rows={6}
                    invalid={!!errors.description}
                    {...register('description')}
                  />
                </FormField>
              </CardBody>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader title="Yayın" />
                <CardBody className="space-y-4">
                  <FormField label="Durum" htmlFor="status">
                    <Select id="status" {...register('status')}>
                      <option value="draft">Taslak</option>
                      <option value="active">Yayınla</option>
                    </Select>
                  </FormField>
                  <FormField label="Marka" htmlFor="brandId">
                    <Select id="brandId" {...register('brandId')}>
                      <option value="">— Marka seçin —</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Kategoriler" />
                <CardBody>
                  {categories.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Önce kategori oluşturun.
                    </p>
                  ) : (
                    <ul className="max-h-64 space-y-1.5 overflow-auto pr-1">
                      {categories.map((c) => (
                        <li key={c.id}>
                          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                              checked={categoryIds?.includes(c.id) ?? false}
                              onChange={() => toggleCategory(c.id)}
                            />
                            <span>{c.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader
              title="Görseller"
              description="Görsel URL'leri ekleyin. Gerçek yükleme özelliği sonraki sürümde eklenecektir."
            />
            <CardBody className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  placeholder="https://…"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addImage}
                >
                  <Plus className="h-4 w-4" /> Ekle
                </Button>
              </div>
              {(images ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">Henüz görsel yok.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {images.map((url, i) => (
                    <li
                      key={`${url}-${i}`}
                      className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-32 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute right-1 top-1 rounded bg-white/90 p-1 text-rose-600 opacity-0 shadow-sm transition group-hover:opacity-100"
                        aria-label="remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <div className="space-y-4">
            <Card>
              <CardHeader title="Taban Fiyat" description="Varyantlar ayrıca fiyatlandırılabilir." />
              <CardBody>
                <FormField
                  label="Fiyat (TL)"
                  htmlFor="basePriceTry"
                  required
                  error={errors.basePriceTry?.message}
                  hint={
                    basePriceTry
                      ? `Kuruş: ${parseTryToKurus(basePriceTry)}`
                      : undefined
                  }
                >
                  <Input
                    id="basePriceTry"
                    inputMode="decimal"
                    placeholder="199.90"
                    invalid={!!errors.basePriceTry}
                    {...register('basePriceTry')}
                  />
                </FormField>
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Varyantlar"
                description="Seçenekler tanımlayın, sistem kombinasyonları üretir."
              />
              <CardBody>
                <VariantBuilder
                  options={variantOptions}
                  rows={variantRows}
                  onOptionsChange={setVariantOptions}
                  onRowsChange={setVariantRows}
                  basePriceTry={basePriceTry}
                />
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader title="Arama Motoru Optimizasyonu" />
            <CardBody className="space-y-4">
              <FormField label="Meta Başlık" htmlFor="seoTitle" error={errors.seoTitle?.message}>
                <Input id="seoTitle" invalid={!!errors.seoTitle} {...register('seoTitle')} />
              </FormField>
              <FormField
                label="Meta Açıklama"
                htmlFor="seoDescription"
                error={errors.seoDescription?.message}
              >
                <Textarea
                  id="seoDescription"
                  rows={3}
                  invalid={!!errors.seoDescription}
                  {...register('seoDescription')}
                />
              </FormField>
              <FormField label="OG Görsel URL" htmlFor="ogImage" error={errors.ogImage?.message}>
                <Input id="ogImage" invalid={!!errors.ogImage} {...register('ogImage')} />
              </FormField>
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={submitting}>
          <Save className="h-4 w-4" /> {submitLabel}
        </Button>
      </div>
    </form>
  );
}

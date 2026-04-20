import { z } from 'zod';

export const ProductFormSchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(255),
  slug: z
    .string()
    .min(2, 'En az 2 karakter')
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Küçük harf, rakam ve tire kullanın'),
  description: z.string().max(10_000).optional().or(z.literal('')),
  brandId: z.string().uuid().optional().or(z.literal('')),
  categoryIds: z.array(z.string().uuid()).default([]),
  status: z.enum(['draft', 'active']).default('draft'),
  seoTitle: z.string().max(255).optional().or(z.literal('')),
  seoDescription: z.string().max(500).optional().or(z.literal('')),
  ogImage: z.string().url('Geçerli URL girin').optional().or(z.literal('')),
  images: z.array(z.string().url('Geçerli URL girin')).default([]),
  basePriceTry: z
    .string()
    .min(1, 'Fiyat giriniz')
    .regex(/^[0-9]+([.,][0-9]{1,2})?$/, 'Ör: 199.90'),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;

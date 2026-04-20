import { z } from 'zod';
import { ProductStatusEnum, SlugSchema } from './create-product.schema';

export const UpdateProductSchema = z
  .object({
    slug: SlugSchema.optional(),
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(50_000).nullable().optional(),
    brandId: z.string().uuid().nullable().optional(),
    status: ProductStatusEnum.optional(),
    categoryIds: z.array(z.string().uuid()).max(50).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Body must contain at least one field');
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

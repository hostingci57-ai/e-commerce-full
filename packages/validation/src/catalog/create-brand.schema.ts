import { z } from 'zod';
import { SlugSchema } from './create-product.schema';

export const CreateBrandSchema = z.object({
  slug: SlugSchema,
  name: z.string().trim().min(1).max(255),
});
export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;

export const UpdateBrandSchema = CreateBrandSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  'Body must contain at least one field',
);
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;

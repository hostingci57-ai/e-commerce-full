import { z } from 'zod';
import { SlugSchema } from './create-product.schema';

export const CreateCategorySchema = z.object({
  slug: SlugSchema,
  name: z.string().trim().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).max(10_000).optional().default(0),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  'Body must contain at least one field',
);
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

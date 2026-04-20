import { z } from 'zod';

const toInt = (d: number, min: number, max: number) =>
  z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return d;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(max, Math.max(min, n));
    });

export const ListProductsQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  query: z.string().trim().min(1).max(120).optional(),
  limit: toInt(20, 1, 100),
  /** Opaque cursor = base64 of last-seen ISO timestamp + id */
  cursor: z.string().max(200).optional(),
  sort: z.enum(['created_desc', 'created_asc', 'title_asc', 'title_desc']).optional().default('created_desc'),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;

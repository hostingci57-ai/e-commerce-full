import { z } from 'zod';

export const SearchProductsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 20;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(50, Math.max(1, n));
    }),
  offset: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 0;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(10_000, Math.max(0, n));
    }),
});
export type SearchProductsQuery = z.infer<typeof SearchProductsQuerySchema>;

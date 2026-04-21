import { z } from 'zod';

/**
 * Product-review domain schemas — FSD 4.3 PDP reviews.
 *
 * Customers post 1 review per product; verified buyers (delivered order) get
 * auto-approved while others sit in PENDING until admin moderation.
 */
export const ReviewStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SPAM']);
export type ReviewStatusValue = z.infer<typeof ReviewStatusEnum>;

export const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(200).optional(),
  comment: z.string().trim().min(1).max(5_000).optional(),
});
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const ListPublicReviewsQuerySchema = z.object({
  sort: z.enum(['newest', 'highest', 'lowest']).optional().default('newest'),
  page: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 1;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.max(1, n);
    }),
  pageSize: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 10;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(50, Math.max(1, n));
    }),
});
export type ListPublicReviewsQuery = z.infer<typeof ListPublicReviewsQuerySchema>;

export const ListAdminReviewsQuerySchema = z.object({
  status: ReviewStatusEnum.optional(),
  productId: z.string().uuid().optional(),
  rating: z
    .union([z.string().regex(/^[1-5]$/), z.number().int().min(1).max(5)])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return typeof v === 'string' ? parseInt(v, 10) : v;
    }),
  page: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 1;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.max(1, n);
    }),
  pageSize: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 20;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(100, Math.max(1, n));
    }),
});
export type ListAdminReviewsQuery = z.infer<typeof ListAdminReviewsQuerySchema>;

export const RejectReviewSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type RejectReviewInput = z.infer<typeof RejectReviewSchema>;

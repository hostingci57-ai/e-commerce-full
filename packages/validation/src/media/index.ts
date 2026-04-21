import { z } from 'zod';

export const MEDIA_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export const PresignedUploadSchema = z.object({
  filename: z.string().trim().min(1).max(256),
  contentType: z.enum(MEDIA_ALLOWED_CONTENT_TYPES),
  sizeBytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
});
export type PresignedUploadInput = z.infer<typeof PresignedUploadSchema>;

export const CreateMediaAssetSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(512)
    /** Paths must live under the tenant prefix; final check in service. */
    .regex(/^tenants\//, 'Invalid key prefix'),
  filename: z.string().trim().min(1).max(256),
  contentType: z.enum(MEDIA_ALLOWED_CONTENT_TYPES),
  sizeBytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(16).default([]),
});
export type CreateMediaAssetInput = z.infer<typeof CreateMediaAssetSchema>;

export const ListMediaAssetsQuerySchema = z.object({
  kind: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
  tag: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  cursor: z.string().optional(),
});
export type ListMediaAssetsQuery = z.infer<typeof ListMediaAssetsQuerySchema>;

import { z } from 'zod';

/**
 * SEO tools schemas (FSD 16). Redirects are exact-path matches; future
 * iterations may add glob/regex support.
 */

const pathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^\//, 'Path must start with /');

export const CreateRedirectSchema = z.object({
  fromPath: pathSchema,
  toPath: z
    .string()
    .trim()
    .min(1)
    .max(500),
  statusCode: z
    .union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)])
    .optional()
    .default(301),
  isActive: z.boolean().optional().default(true),
});
export type CreateRedirectInput = z.infer<typeof CreateRedirectSchema>;

export const UpdateRedirectSchema = CreateRedirectSchema.partial();
export type UpdateRedirectInput = z.infer<typeof UpdateRedirectSchema>;

export const ListRedirectsQuerySchema = z.object({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  query: z.string().trim().min(1).max(200).optional(),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 50;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(500, Math.max(1, n));
    }),
});
export type ListRedirectsQuery = z.infer<typeof ListRedirectsQuerySchema>;

export const ImportRedirectsSchema = z.object({
  csv: z.string().min(1).max(500_000),
  overwrite: z.boolean().optional().default(false),
});
export type ImportRedirectsInput = z.infer<typeof ImportRedirectsSchema>;

export const UpdateSeoSettingSchema = z.object({
  defaultTitle: z.string().trim().max(255).nullable().optional(),
  titleTemplate: z.string().trim().max(255).nullable().optional(),
  defaultDescription: z.string().trim().max(500).nullable().optional(),
  defaultOgImage: z.string().trim().max(500).url().nullable().optional(),
  robotsTxt: z.string().max(10_000).nullable().optional(),
  googleSiteVerification: z.string().trim().max(128).nullable().optional(),
  bingSiteVerification: z.string().trim().max(128).nullable().optional(),
});
export type UpdateSeoSettingInput = z.infer<typeof UpdateSeoSettingSchema>;

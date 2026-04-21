import { z } from 'zod';

/**
 * i18n engine schemas.
 *
 * - Language: global catalog (ISO code + display names + rtl flag)
 * - TenantLanguage: per-tenant active language set + default
 * - UiStringBundle: per-tenant, per-language, per-namespace key/value dict
 */

const langCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(10)
  .regex(/^[a-zA-Z][a-zA-Z0-9-]*$/, 'Invalid BCP-47-like language code')
  .transform((v) => v.toLowerCase());

export const UpsertLanguageSchema = z.object({
  code: langCodeSchema,
  name: z.string().trim().min(1).max(64),
  nativeName: z.string().trim().min(1).max(64),
  rtl: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});
export type UpsertLanguageInput = z.infer<typeof UpsertLanguageSchema>;

export const UpdateLanguageSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  nativeName: z.string().trim().min(1).max(64).optional(),
  rtl: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateLanguageInput = z.infer<typeof UpdateLanguageSchema>;

export const UpsertTenantLanguageSchema = z.object({
  languageCode: langCodeSchema,
  isDefault: z.boolean().optional().default(false),
  isPublished: z.boolean().optional().default(true),
});
export type UpsertTenantLanguageInput = z.infer<typeof UpsertTenantLanguageSchema>;

const namespaceSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_.-]*$/, 'Namespace must be lowercase + url-safe');

export const UpdateUiBundleSchema = z.object({
  languageCode: langCodeSchema,
  namespace: namespaceSchema,
  strings: z.record(z.string().max(10_000)),
});
export type UpdateUiBundleInput = z.infer<typeof UpdateUiBundleSchema>;

export const GetBundleQuerySchema = z.object({
  lang: langCodeSchema,
  ns: namespaceSchema.optional().default('storefront'),
});
export type GetBundleQuery = z.infer<typeof GetBundleQuerySchema>;

export const ListBundlesQuerySchema = z.object({
  languageCode: langCodeSchema.optional(),
  namespace: namespaceSchema.optional(),
});
export type ListBundlesQuery = z.infer<typeof ListBundlesQuerySchema>;

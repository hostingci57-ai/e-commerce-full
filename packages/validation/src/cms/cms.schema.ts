import { z } from 'zod';

/**
 * CMS domain schemas (FSD 17). Pages store HTML content (rich editor output).
 * Slugs are URL-safe lowercase letters/digits/hyphen/underscore, 1..120 chars.
 */

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, 'Slug must be url-safe lowercase');

export const CreateCmsPageSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(255),
  content: z.string().max(200_000), // rich editor output (HTML or markdown)
  metaTitle: z.string().trim().max(255).nullable().optional(),
  metaDescription: z.string().trim().max(500).nullable().optional(),
  isPublished: z.boolean().optional().default(false),
  showInFooter: z.boolean().optional().default(false),
  showInHeader: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});
export type CreateCmsPageInput = z.infer<typeof CreateCmsPageSchema>;

export const UpdateCmsPageSchema = CreateCmsPageSchema.partial();
export type UpdateCmsPageInput = z.infer<typeof UpdateCmsPageSchema>;

export const ListCmsPagesQuerySchema = z.object({
  isPublished: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  location: z.enum(['header', 'footer']).optional(),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 50;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(200, Math.max(1, n));
    }),
});
export type ListCmsPagesQuery = z.infer<typeof ListCmsPagesQuerySchema>;

/**
 * Menu items — flat list for MVP. Nested children are accepted as unknown[]
 * to sidestep Zod's recursive-type-inference sharp edges; the admin UI edits
 * a flat list anyway.
 */
export const MenuItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  type: z.enum(['page', 'category', 'url']),
  target: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  children: z.array(z.unknown()).max(50).optional(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const UpdateCmsMenuSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  items: z.array(MenuItemSchema).max(100),
  isActive: z.boolean().optional(),
});
export type UpdateCmsMenuInput = z.infer<typeof UpdateCmsMenuSchema>;

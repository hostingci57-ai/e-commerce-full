import { z } from 'zod';

/**
 * Placeholder — ProductTranslation model is not in the Prisma schema yet.
 * Translations are stored in Product.settings-like stub (description i18n) when
 * the ProductTranslation model is added in a later migration. For now, accept
 * payload shape and return 501 Not Implemented from the controller.
 */
export const TranslationSchema = z.object({
  locale: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}(-[a-z]{2})?$/, 'Invalid locale (e.g. "tr", "en-gb")'),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(50_000).optional(),
});
export type TranslationInput = z.infer<typeof TranslationSchema>;

export const TranslationsBatchSchema = z.object({
  translations: z.array(TranslationSchema).min(1).max(20),
});
export type TranslationsBatchInput = z.infer<typeof TranslationsBatchSchema>;

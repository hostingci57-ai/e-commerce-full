import { z } from 'zod';

/** Slug: lowercase kebab, 2-120 chars. */
export const SlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug — use lowercase-kebab');

/** BigInt money coerced from string|number to bigint (minor units). */
export const MinorUnitsSchema = z
  .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
  .transform((v) => (typeof v === 'string' ? BigInt(v) : BigInt(v)))
  .refine((v) => v >= 0n && v <= 9_999_999_999_999n, 'Price out of range');

export const CurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Currency must be ISO-4217 alpha-3');

export const ProductStatusEnum = z.enum(['draft', 'active', 'archived']);

export const CreateProductSchema = z.object({
  slug: SlugSchema,
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(50_000).optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  status: ProductStatusEnum.optional().default('draft'),
  categoryIds: z.array(z.string().uuid()).max(50).optional().default([]),
  /** Optional: create a default variant in the same TX. */
  variant: z
    .object({
      sku: z.string().trim().min(1).max(64),
      priceMinorUnits: MinorUnitsSchema,
      compareAtMinorUnits: MinorUnitsSchema.optional(),
      currency: CurrencySchema,
      stockOnHand: z.number().int().nonnegative().optional().default(0),
      weightGrams: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

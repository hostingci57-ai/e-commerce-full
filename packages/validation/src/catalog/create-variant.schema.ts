import { z } from 'zod';
import { CurrencySchema, MinorUnitsSchema } from './create-product.schema';

export const VariantInputSchema = z.object({
  /** When set, treated as UPDATE of existing variant. */
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(64),
  priceMinorUnits: MinorUnitsSchema,
  compareAtMinorUnits: MinorUnitsSchema.optional().nullable(),
  currency: CurrencySchema,
  stockOnHand: z.number().int().nonnegative().optional().default(0),
  weightGrams: z.number().int().nonnegative().optional().nullable(),
  optionValue1Id: z.string().uuid().optional().nullable(),
  optionValue2Id: z.string().uuid().optional().nullable(),
  optionValue3Id: z.string().uuid().optional().nullable(),
});
export type VariantInput = z.infer<typeof VariantInputSchema>;

export const BatchVariantsSchema = z.object({
  variants: z.array(VariantInputSchema).min(1).max(200),
});
export type BatchVariantsInput = z.infer<typeof BatchVariantsSchema>;

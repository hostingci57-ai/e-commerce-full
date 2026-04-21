import { z } from 'zod';

const bigIntLike = z.union([
  z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
  z.number().int().nonnegative().transform((v) => BigInt(v)),
]);

export const ShippingProviderCodeSchema = z.enum([
  'flat_rate',
  'free_shipping',
  'manual',
]);
export type ShippingProviderCode = z.infer<typeof ShippingProviderCodeSchema>;

export const ShippingMethodConfigSchema = z.object({
  providerCode: ShippingProviderCodeSchema,
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/i, 'Code must be alphanumeric/underscore'),
  displayName: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(1000).optional().default(0),
  estimatedDaysMin: z.number().int().min(0).max(365).optional().nullable(),
  estimatedDaysMax: z.number().int().min(0).max(365).optional().nullable(),
  freeShippingThreshold: bigIntLike.optional().nullable(),
});
export type ShippingMethodConfigInput = z.infer<typeof ShippingMethodConfigSchema>;

export const UpdateShippingMethodConfigSchema =
  ShippingMethodConfigSchema.partial().omit({
    providerCode: true,
    code: true,
  });
export type UpdateShippingMethodConfigInput = z.infer<
  typeof UpdateShippingMethodConfigSchema
>;

/** Select a shipping rate during checkout. */
export const SelectShippingRateSchema = z.object({
  providerCode: ShippingProviderCodeSchema,
  rateCode: z.string().trim().min(1).max(64),
});
export type SelectShippingRateInput = z.infer<typeof SelectShippingRateSchema>;

/** Admin "create shipment" (FSD 5.3.4) — supersedes the older CreateShipmentSchema. */
export const CreateProviderShipmentSchema = z.object({
  providerCode: ShippingProviderCodeSchema,
  trackingNumber: z.string().trim().min(1).max(120).optional(),
  trackingUrl: z.string().trim().url().max(500).optional(),
  note: z.string().trim().max(2000).optional(),
});
export type CreateProviderShipmentInput = z.infer<typeof CreateProviderShipmentSchema>;

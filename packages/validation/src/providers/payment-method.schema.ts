import { z } from 'zod';

const bigIntLike = z.union([
  z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
  z.number().int().nonnegative().transform((v) => BigInt(v)),
]);

export const PaymentProviderCodeSchema = z.enum([
  'cod',
  'bank_transfer',
  'stub_card',
  'manual',
]);
export type PaymentProviderCode = z.infer<typeof PaymentProviderCodeSchema>;

export const PaymentMethodConfigSchema = z.object({
  providerCode: PaymentProviderCodeSchema,
  displayName: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(1000).optional().default(0),
  minAmount: bigIntLike.optional().nullable(),
  maxAmount: bigIntLike.optional().nullable(),
});
export type PaymentMethodConfigInput = z.infer<typeof PaymentMethodConfigSchema>;

export const UpdatePaymentMethodConfigSchema = PaymentMethodConfigSchema.partial().omit({
  providerCode: true,
});
export type UpdatePaymentMethodConfigInput = z.infer<
  typeof UpdatePaymentMethodConfigSchema
>;

/** Select a payment method during checkout. */
export const SelectPaymentMethodSchema = z.object({
  providerCode: PaymentProviderCodeSchema,
  /** Opaque provider token (e.g. stub card token). Never validated here. */
  token: z.string().trim().max(500).optional(),
  returnUrl: z.string().trim().url().max(500).optional(),
});
export type SelectPaymentMethodInput = z.infer<typeof SelectPaymentMethodSchema>;

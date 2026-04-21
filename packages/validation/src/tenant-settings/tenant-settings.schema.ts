import { z } from 'zod';

const EmailSchema = z.string().trim().toLowerCase().email().max(320);
const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone format');

export const TenantStoreAddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().max(80).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2)
    .regex(/^[A-Z]{2}$/, 'Country must be ISO-3166-1 alpha-2'),
});
export type TenantStoreAddressInput = z.infer<typeof TenantStoreAddressSchema>;

export const UpdateTenantSettingsSchema = z
  .object({
    storeName: z.string().trim().min(1).max(160),
    storeEmail: EmailSchema,
    storePhone: PhoneSchema.optional().nullable(),
    storeAddress: TenantStoreAddressSchema.optional().nullable(),
    currency: z.string().trim().length(3).toUpperCase().default('TRY'),
    defaultLanguage: z.string().trim().min(2).max(10).default('tr'),
    timezone: z.string().trim().max(64).default('Europe/Istanbul'),
    weightUnit: z.enum(['kg', 'g', 'lb', 'oz']).default('kg'),
    dimensionUnit: z.enum(['cm', 'mm', 'in']).default('cm'),
    kvkkContact: EmailSchema.optional().nullable(),
    taxNumber: z.string().trim().max(40).optional().nullable(),
    legalName: z.string().trim().max(200).optional().nullable(),
    logoMediaId: z.string().uuid().optional().nullable(),
    faviconMediaId: z.string().uuid().optional().nullable(),
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Must be #RRGGBB hex')
      .optional()
      .nullable(),
  })
  .partial();
export type UpdateTenantSettingsInput = z.infer<typeof UpdateTenantSettingsSchema>;

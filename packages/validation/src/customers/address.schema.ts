import { z } from 'zod';

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone format');

export const CreateAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  phone: PhoneSchema.optional().nullable(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().max(80).optional().nullable(),
  postalCode: z.string().trim().min(1).max(20),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2)
    .regex(/^[A-Z]{2}$/, 'Country must be ISO-3166-1 alpha-2'),
  isDefault: z.boolean().optional().default(false),
});
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;

export const UpdateAddressSchema = CreateAddressSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  'Body must contain at least one field',
);
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;

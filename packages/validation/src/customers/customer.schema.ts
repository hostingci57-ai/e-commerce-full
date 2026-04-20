import { z } from 'zod';

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone format');

export const UpdateCustomerSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).nullable().optional(),
    lastName: z.string().trim().min(1).max(80).nullable().optional(),
    phone: PhoneSchema.nullable().optional(),
    acceptsMarketing: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Body must contain at least one field');
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

export const ListCustomersQuerySchema = z.object({
  query: z.string().trim().min(1).max(120).optional(),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 20;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(100, Math.max(1, n));
    }),
  cursor: z.string().max(200).optional(),
});
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;

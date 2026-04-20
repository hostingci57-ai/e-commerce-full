import { z } from 'zod';

/**
 * Password policy (FSD 12.3): min 8, one uppercase, one lowercase, one digit.
 * Symbols recommended but not required (for accessibility).
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine((v) => /[0-9]/.test(v), 'Password must contain a digit');

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

/** Customer self-registration (storefront) */
export const CustomerRegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  acceptsMarketing: z.boolean().optional().default(false),
});
export type CustomerRegisterInput = z.infer<typeof CustomerRegisterSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const LogoutSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});
export type LogoutInput = z.infer<typeof LogoutSchema>;

export const UpdateMeSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone format')
    .optional(),
});
export type UpdateMeInput = z.infer<typeof UpdateMeSchema>;

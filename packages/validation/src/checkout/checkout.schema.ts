import { z } from 'zod';

/** Email — looser than RFC but good enough for first pass. */
const EmailSchema = z.string().trim().toLowerCase().email().max(320);

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone format');

export const CheckoutAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  phone: PhoneSchema.optional().nullable(),
  email: EmailSchema.optional(),
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
});
export type CheckoutAddressInput = z.infer<typeof CheckoutAddressSchema>;

/** Checkout start — uses caller's current cart; may optionally pin customer email for guest. */
export const StartCheckoutSchema = z.object({
  guestEmail: EmailSchema.optional(),
});
export type StartCheckoutInput = z.infer<typeof StartCheckoutSchema>;

/** MVP: fixed shipping catalogue. */
export const ShippingMethodEnum = z.enum(['standard', 'express']);
export type ShippingMethod = z.infer<typeof ShippingMethodEnum>;

export const SetShippingSchema = z.object({
  method: ShippingMethodEnum,
});
export type SetShippingInput = z.infer<typeof SetShippingSchema>;

/** MVP: only a stub provider + cash-on-delivery are acknowledged. */
export const PaymentMethodEnum = z.enum(['cod', 'stub_card']);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const SetPaymentSchema = z.object({
  method: PaymentMethodEnum,
  /** Opaque token from stub card form — never validated, stored as-is. */
  stubToken: z.string().trim().max(200).optional(),
});
export type SetPaymentInput = z.infer<typeof SetPaymentSchema>;

export const CompleteCheckoutSchema = z.object({
  /** Optional idempotency marker sent by storefront to avoid double-submit. */
  idempotencyKey: z.string().trim().max(100).optional(),
});
export type CompleteCheckoutInput = z.infer<typeof CompleteCheckoutSchema>;

export const SHIPPING_CATALOGUE: Record<
  ShippingMethod,
  { label: string; priceMinor: bigint; etaDays: number }
> = {
  standard: { label: 'Standard Shipping', priceMinor: 5000n, etaDays: 4 },
  express: { label: 'Express Shipping', priceMinor: 12000n, etaDays: 1 },
};

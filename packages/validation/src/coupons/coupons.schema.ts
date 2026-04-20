import { z } from 'zod';

/**
 * Coupon domain schemas — see FSD 4.4.3 + 15.
 *
 * Money fields are stored as BigInt in DB; the wire format accepts stringified
 * integers OR plain numbers up to Number.MAX_SAFE_INTEGER to keep Next.js form
 * payloads ergonomic.
 */
export const CouponTypeEnum = z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']);
export type CouponTypeValue = z.infer<typeof CouponTypeEnum>;

const bigIntLike = z.union([
  z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
  z.number().int().nonnegative().transform((v) => BigInt(v)),
]);

const bigIntLikeOptional = bigIntLike.optional();

/** Shared coupon body — used by create and (as partial) by update. */
const couponBase = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_\-]+$/, 'Only letters, digits, - and _ allowed'),
  type: CouponTypeEnum,
  /** PERCENT → basis points 1..10000 (= %0.01..%100); FIXED → minor units; FREE_SHIPPING → 0 */
  value: bigIntLike,
  minimumAmount: bigIntLikeOptional.nullable(),
  maximumDiscount: bigIntLikeOptional.nullable(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  usageLimitPerCustomer: z.number().int().positive().nullable().optional(),
  stackable: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  customerGroupIds: z.array(z.string().uuid()).optional().default([]),
  categoryIds: z.array(z.string().uuid()).optional().default([]),
  productIds: z.array(z.string().uuid()).optional().default([]),
});

export const CreateCouponSchema = couponBase.superRefine((val, ctx) => {
  if (val.type === 'PERCENT') {
    // basis points — 1..10000 (%0.01..%100)
    const v = val.value;
    if (v < 1n || v > 10000n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PERCENT value must be basis points between 1 and 10000',
        path: ['value'],
      });
    }
  }
  if (val.type === 'FIXED' && val.value < 1n) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'FIXED value must be at least 1 minor unit',
      path: ['value'],
    });
  }
  if (val.type === 'FREE_SHIPPING' && val.value !== 0n) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'FREE_SHIPPING value must be 0',
      path: ['value'],
    });
  }
  if (val.startsAt && val.endsAt && new Date(val.endsAt) <= new Date(val.startsAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    });
  }
});
export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;

export const UpdateCouponSchema = couponBase.partial();
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;

export const ListCouponsQuerySchema = z.object({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  query: z.string().trim().min(1).max(64).optional(),
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
export type ListCouponsQuery = z.infer<typeof ListCouponsQuerySchema>;

import { z } from 'zod';

export const AddCartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});
export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(999),
});
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;

export const ApplyCouponSchema = z.object({
  code: z.string().trim().min(1).max(64),
});
export type ApplyCouponInput = z.infer<typeof ApplyCouponSchema>;

export const MergeCartSchema = z.object({
  /** Source cart token (guest) to merge into the authenticated customer cart. */
  guestCartToken: z.string().uuid(),
});
export type MergeCartInput = z.infer<typeof MergeCartSchema>;

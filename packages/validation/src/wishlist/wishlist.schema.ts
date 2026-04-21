import { z } from 'zod';

/**
 * Wishlist domain schemas — FSD 4.6 customer account.
 * 1 entry per (customer, product); variant is optional so a customer can
 * "save for later" without committing to a specific size/color.
 */
export const AddToWishlistSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
});
export type AddToWishlistInput = z.infer<typeof AddToWishlistSchema>;

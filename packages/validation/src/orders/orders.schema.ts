import { z } from 'zod';

/**
 * Schema-side mirror of Prisma's OrderStatus enum. Keep in sync with
 * packages/db/prisma/schema.prisma.
 */
export const OrderStatusEnum = z.enum([
  'draft',
  'pending_payment',
  'payment_success',
  'preparing',
  'shipped',
  'delivered',
  'closed',
  'cancelled',
  'refund_requested',
  'refunded',
  'partial_refunded',
]);
export type OrderStatusValue = z.infer<typeof OrderStatusEnum>;

export const RefundReasonCategoryEnum = z.enum([
  'DAMAGED',
  'WRONG_ITEM',
  'SIZE_ISSUE',
  'NOT_AS_DESCRIBED',
  'CHANGED_MIND',
  'OTHER',
]);
export type RefundReasonCategoryValue = z.infer<typeof RefundReasonCategoryEnum>;

const toInt = (d: number, min: number, max: number) =>
  z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return d;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(max, Math.max(min, n));
    });

export const ListOrdersQuerySchema = z.object({
  status: OrderStatusEnum.optional(),
  customerId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  query: z.string().trim().min(1).max(120).optional(),
  limit: toInt(20, 1, 100),
  cursor: z.string().max(200).optional(),
});
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;

export const UpdateOrderStatusSchema = z.object({
  to: OrderStatusEnum,
  note: z.string().trim().max(2000).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;

export const CancelOrderSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

const bigIntLike = z.union([
  z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
  z.number().int().nonnegative().transform((v) => BigInt(v)),
]);

export const RefundItemSelectionSchema = z.object({
  orderItemId: z.string().uuid(),
  qty: z.number().int().positive(),
  amount: bigIntLike,
});
export type RefundItemSelection = z.infer<typeof RefundItemSelectionSchema>;

/**
 * Customer-facing refund request. Kept backwards-compatible with the stub
 * version that only accepted `reason`: `reasonCategory`, `itemSelections`
 * and `requestedAmount` are optional — if absent the service falls back to
 * a whole-order refund for the order's outstanding amount.
 */
export const RefundRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  reasonCategory: RefundReasonCategoryEnum.optional().default('OTHER'),
  itemSelections: z.array(RefundItemSelectionSchema).optional(),
  requestedAmount: bigIntLike.optional(),
});
export type RefundRequestInput = z.infer<typeof RefundRequestSchema>;

export const ApproveRefundSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  /** Final approved amount in minor units. When omitted defaults to requestedAmount. */
  approvedAmount: bigIntLike.optional(),
  /** Whether the approved refund is partial (triggers partial_refunded) or full. */
  partial: z.boolean().optional().default(false),
});
export type ApproveRefundInput = z.infer<typeof ApproveRefundSchema>;

export const RejectRefundSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(2000),
});
export type RejectRefundInput = z.infer<typeof RejectRefundSchema>;

export const ListRefundsQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'])
    .optional(),
  orderId: z.string().uuid().optional(),
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
export type ListRefundsQuery = z.infer<typeof ListRefundsQuerySchema>;

// ---------- Draft orders (FSD 5.3.2) ---------------------------------------

export const CreateDraftOrderLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(999),
  /** Optional override — when absent service snapshots the current variant price. */
  priceMinorUnits: bigIntLike.optional(),
});
export type CreateDraftOrderLineInput = z.infer<typeof CreateDraftOrderLineSchema>;

export const CreateDraftOrderSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  guestEmail: z.string().email().nullable().optional(),
  currency: z.string().length(3),
  shippingMinor: bigIntLike.optional(),
  taxMinor: bigIntLike.optional(),
  discountMinor: bigIntLike.optional(),
  note: z.string().trim().max(2000).optional(),
  lines: z.array(CreateDraftOrderLineSchema).min(1).max(200),
});
export type CreateDraftOrderInput = z.infer<typeof CreateDraftOrderSchema>;

export const UpdateDraftOrderSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  guestEmail: z.string().email().nullable().optional(),
  shippingMinor: bigIntLike.optional(),
  taxMinor: bigIntLike.optional(),
  discountMinor: bigIntLike.optional(),
  note: z.string().trim().max(2000).optional(),
  lines: z.array(CreateDraftOrderLineSchema).min(1).max(200).optional(),
});
export type UpdateDraftOrderInput = z.infer<typeof UpdateDraftOrderSchema>;

export const ConvertDraftOrderSchema = z.object({
  notifyCustomer: z.boolean().optional().default(false),
});
export type ConvertDraftOrderInput = z.infer<typeof ConvertDraftOrderSchema>;

export const CreateShipmentSchema = z.object({
  carrier: z.string().trim().min(1).max(80),
  trackingNumber: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).optional(),
});
export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;

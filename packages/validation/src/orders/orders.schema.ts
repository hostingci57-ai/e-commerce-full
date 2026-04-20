import { z } from 'zod';

/**
 * Schema-side mirror of Prisma's OrderStatus enum. Keep in sync with
 * packages/db/prisma/schema.prisma.
 */
export const OrderStatusEnum = z.enum([
  'pending_payment',
  'payment_success',
  'preparing',
  'shipped',
  'delivered',
  'closed',
  'cancelled',
  'refund_requested',
  'refunded',
]);
export type OrderStatusValue = z.infer<typeof OrderStatusEnum>;

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

export const RefundRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});
export type RefundRequestInput = z.infer<typeof RefundRequestSchema>;

export const CreateShipmentSchema = z.object({
  carrier: z.string().trim().min(1).max(80),
  trackingNumber: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).optional(),
});
export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;

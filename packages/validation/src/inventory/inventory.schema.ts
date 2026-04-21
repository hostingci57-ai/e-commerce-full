import { z } from 'zod';

/**
 * Inventory domain schemas — see FSD 5.2.7 + 11.
 *
 * `InventoryLevel` is the canonical per-variant stock, `InventoryMovement`
 * is an append-only audit log of every delta. Admin endpoints drive both.
 */

export const InventoryMovementTypeEnum = z.enum([
  'ADJUSTMENT',
  'RESERVATION',
  'RELEASE',
  'FULFILLMENT',
  'RETURN',
  'DAMAGE',
  'INITIAL',
]);
export type InventoryMovementTypeValue = z.infer<typeof InventoryMovementTypeEnum>;

export const ADJUSTMENT_REASONS = [
  'manual_adjustment',
  'return',
  'damage',
  'initial',
  'bulk_import',
  'other',
] as const;
export const AdjustReasonEnum = z.enum(ADJUSTMENT_REASONS);

/** POST /v1/inventory/adjust */
export const AdjustStockSchema = z.object({
  variantId: z.string().uuid(),
  /** signed integer delta — positive adds, negative removes. 0 is rejected. */
  delta: z.number().int().refine((n) => n !== 0, 'delta must be non-zero'),
  reason: AdjustReasonEnum.optional().default('manual_adjustment'),
  note: z.string().trim().max(500).optional().nullable(),
  reference: z.string().trim().max(200).optional().nullable(),
});
export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;

/** PATCH /v1/inventory/levels/:variantId */
export const UpdateInventoryLevelSchema = z.object({
  lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
});
export type UpdateInventoryLevelInput = z.infer<typeof UpdateInventoryLevelSchema>;

const intLike = z
  .union([z.string().regex(/^\d+$/), z.number().int()])
  .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v));

/** GET /v1/inventory/levels */
export const ListInventoryLevelsQuerySchema = z.object({
  query: z.string().trim().min(1).max(128).optional(),
  lowStock: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  outOfStock: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  limit: intLike.optional().transform((v) => {
    if (v === undefined) return 25;
    return Math.min(200, Math.max(1, v as number));
  }),
  page: intLike.optional().transform((v) => {
    if (v === undefined) return 1;
    return Math.max(1, v as number);
  }),
});
export type ListInventoryLevelsQuery = z.infer<typeof ListInventoryLevelsQuerySchema>;

/** GET /v1/inventory/movements */
export const ListMovementsQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  type: InventoryMovementTypeEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: intLike.optional().transform((v) => {
    if (v === undefined) return 50;
    return Math.min(200, Math.max(1, v as number));
  }),
  page: intLike.optional().transform((v) => {
    if (v === undefined) return 1;
    return Math.max(1, v as number);
  }),
});
export type ListMovementsQuery = z.infer<typeof ListMovementsQuerySchema>;

/**
 * POST /v1/inventory/bulk-import
 * Accept a small JSON array (≤2000 rows); CSV parsing happens client-side or
 * upstream. Each row targets a variant by SKU (cross-variant id lookups are
 * awkward for ops importing spreadsheets).
 */
export const BulkImportItemSchema = z.object({
  variantSku: z.string().trim().min(1).max(128),
  stockOnHand: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
});
export const BulkImportSchema = z.object({
  items: z.array(BulkImportItemSchema).min(1).max(2000),
});
export type BulkImportInput = z.infer<typeof BulkImportSchema>;
export type BulkImportItem = z.infer<typeof BulkImportItemSchema>;

import { z } from 'zod';

/**
 * Event-type pattern: lowercase dotted tokens; supports wildcards like
 * `order.*`. Two tokens only (domain + action) to keep matching cheap.
 */
const EventPatternSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(
    /^[a-z0-9_]+(\.(\*|[a-z0-9_]+))$/,
    'Event must match `domain.action` or `domain.*`',
  );

export const CreateWebhookSubscriptionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().url().max(1024),
  /** Accept user-supplied secret; service generates one if omitted. */
  secret: z.string().trim().min(16).max(256).optional(),
  events: z.array(EventPatternSchema).min(1).max(64),
  isActive: z.boolean().default(true),
});
export type CreateWebhookSubscriptionInput = z.infer<
  typeof CreateWebhookSubscriptionSchema
>;

export const UpdateWebhookSubscriptionSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  url: z.string().url().max(1024).optional(),
  secret: z.string().trim().min(16).max(256).optional(),
  events: z.array(EventPatternSchema).min(1).max(64).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWebhookSubscriptionInput = z.infer<
  typeof UpdateWebhookSubscriptionSchema
>;

export const ListWebhookDeliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  status: z.enum(['success', 'failed', 'pending']).optional(),
});
export type ListWebhookDeliveriesQuery = z.infer<
  typeof ListWebhookDeliveriesQuerySchema
>;

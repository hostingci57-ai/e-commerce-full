import { Injectable } from '@nestjs/common';
import type { Prisma } from '@ecf/db';

/**
 * Transactional Outbox (FSD 6.4). Writes an `outbox_events` row inside the
 * same Prisma transaction as the business aggregate write, guaranteeing the
 * event is durable iff the aggregate is durable. A separate dispatcher worker
 * (added in Faz 6) polls `pending`, publishes, and marks `published`.
 *
 * This service is deliberately tx-scoped — callers MUST pass the Prisma
 * transaction handle they obtained from `$transaction()` or `withTenant()`.
 */
@Injectable()
export class OutboxService {
  /**
   * Append an event to the outbox. Must be called inside a Prisma transaction
   * where `app.current_tenant_id` has been set (so RLS insert policy passes).
   */
  async publish(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      payload: Prisma.InputJsonValue;
    },
  ): Promise<{ id: string }> {
    const row = await tx.outboxEvent.create({
      data: {
        tenantId: params.tenantId,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: params.eventType,
        payload: params.payload,
      },
      select: { id: true },
    });
    return row;
  }
}

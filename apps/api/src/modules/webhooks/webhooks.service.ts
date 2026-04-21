import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Queue } from 'bullmq';
import type { Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  CreateWebhookSubscriptionInput,
  ListWebhookDeliveriesQuery,
  UpdateWebhookSubscriptionInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { QUEUE_WEBHOOK_DELIVERY } from '../../common/queue/queue.module';

function generateSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly ctx: TenantContextService,
    @Inject(QUEUE_WEBHOOK_DELIVERY) private readonly webhookQ: Queue,
  ) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) {
      throw new NotFoundException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return id;
  }

  async create(input: CreateWebhookSubscriptionInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, (tx) =>
      tx.webhookSubscription.create({
        data: {
          tenantId,
          name: input.name,
          url: input.url,
          secret: input.secret ?? generateSecret(),
          events: input.events,
          isActive: input.isActive,
        },
      }),
    );
  }

  async list() {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, (tx) =>
      tx.webhookSubscription.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(id: string) {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId }, (tx) =>
      tx.webhookSubscription.findUnique({
        where: { tenantId_id: { tenantId, id } },
      }),
    );
    if (!row) {
      throw new NotFoundException({
        code: 'webhook_subscription_not_found',
        message: 'Subscription not found',
      });
    }
    return row;
  }

  async update(id: string, input: UpdateWebhookSubscriptionInput) {
    const tenantId = this.requireTenant();
    await this.findOne(id); // 404 guard
    return withTenant({ tenantId, userId: this.ctx.userId }, (tx) =>
      tx.webhookSubscription.update({
        where: { tenantId_id: { tenantId, id } },
        data: {
          name: input.name,
          url: input.url,
          secret: input.secret,
          events: input.events,
          isActive: input.isActive,
        },
      }),
    );
  }

  async delete(id: string) {
    const tenantId = this.requireTenant();
    await this.findOne(id);
    await withTenant({ tenantId, userId: this.ctx.userId }, (tx) =>
      tx.webhookSubscription.delete({
        where: { tenantId_id: { tenantId, id } },
      }),
    );
    return { ok: true as const };
  }

  async listDeliveries(id: string, q: ListWebhookDeliveriesQuery) {
    const tenantId = this.requireTenant();
    await this.findOne(id);
    const where: Prisma.WebhookDeliveryWhereInput = {
      tenantId,
      subscriptionId: id,
    };
    if (q.status === 'success') where.deliveredAt = { not: null };
    if (q.status === 'failed') {
      where.deliveredAt = null;
      where.errorMessage = { not: null };
    }
    if (q.status === 'pending') {
      where.deliveredAt = null;
      where.errorMessage = null;
    }
    if (q.cursor) {
      try {
        const [iso, cid] = Buffer.from(q.cursor, 'base64')
          .toString('utf-8')
          .split('|');
        if (iso && cid) {
          where.AND = [
            {
              OR: [
                { createdAt: { lt: new Date(iso) } },
                { AND: [{ createdAt: new Date(iso) }, { id: { lt: cid } }] },
              ],
            },
          ];
        }
      } catch {
        /* ignore malformed cursor */
      }
    }
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.webhookDelivery.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
      });
      const hasMore = rows.length > q.limit;
      const items = hasMore ? rows.slice(0, q.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? Buffer.from(
              `${last.createdAt.toISOString()}|${last.id}`,
            ).toString('base64')
          : null;
      return { items, nextCursor, hasMore };
    });
  }

  /**
   * Re-enqueue a failed (or otherwise) delivery for retry. Admin endpoint —
   * bumps the BullMQ queue directly so the webhook processor can replay.
   */
  async retryDelivery(subId: string, deliveryId: string) {
    const tenantId = this.requireTenant();
    const sub = await this.findOne(subId);
    const delivery = await withTenant({ tenantId }, (tx) =>
      tx.webhookDelivery.findUnique({
        where: { tenantId_id: { tenantId, id: deliveryId } },
      }),
    );
    if (!delivery) {
      throw new NotFoundException({
        code: 'delivery_not_found',
        message: 'Delivery not found',
      });
    }
    if (delivery.subscriptionId !== sub.id) {
      throw new BadRequestException({
        code: 'delivery_wrong_subscription',
        message: 'Delivery does not belong to this subscription',
      });
    }

    await this.webhookQ.add(
      'deliver',
      {
        subscriptionId: sub.id,
        tenantId,
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        aggregateType: 'unknown',
        aggregateId: sub.id,
        payload: { replay: true, originalDeliveryId: delivery.id },
        createdAt: new Date().toISOString(),
        manualRetry: true,
      },
      {
        jobId: `retry:${delivery.id}:${Date.now()}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
    return { ok: true as const };
  }
}

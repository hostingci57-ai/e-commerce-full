import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, type Job, type Queue } from 'bullmq';
import type IORedis from 'ioredis';
import { prisma } from '@ecf/db';
import { AppConfigService } from '../config/config.service';
import {
  BULL_CONNECTION,
  QUEUE_EMAIL_DELIVERY,
  QUEUE_NAMES,
  QUEUE_WEBHOOK_DELIVERY,
} from '../queue/queue.module';
import { OutboxDispatcherService } from './outbox-dispatcher.service';

/**
 * Fan-out worker for the `outbox-events` queue.
 *
 * Each claimed OutboxEvent is matched against:
 *  - webhook_subscriptions whose `events[]` contains the event type
 *  - email triggers baked into the platform (customer.registered → welcome,
 *    order.created → order-confirmation, order.status_changed → shipped /
 *    delivered / cancelled, refund.approved → refund-approved)
 *
 * Each match is enqueued on its own queue (webhook-delivery or email-delivery)
 * with a ProcessedEvent idempotency row so a replay of the same outbox row
 * doesn't re-notify the same consumer.
 */
export interface OutboxJobData {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

type EmailTrigger = { template: string; to?: string; dataMap?: string };

/**
 * Pure function — given an event type (+ payload) return the ordered email
 * templates that should fire. Encapsulated here so the dispatcher stays
 * testable without Redis / Prisma.
 */
export function resolveEmailTriggers(
  eventType: string,
  payload: unknown,
): EmailTrigger[] {
  switch (eventType) {
    case 'customer.registered':
      return [{ template: 'welcome' }];
    case 'order.created':
      return [{ template: 'order-confirmation' }];
    case 'order.status_changed': {
      const to =
        (payload as { to?: string } | null)?.to ??
        (payload as { newStatus?: string } | null)?.newStatus ??
        null;
      if (to === 'shipped') return [{ template: 'order-shipped' }];
      if (to === 'delivered') return [{ template: 'order-delivered' }];
      if (to === 'cancelled') return [{ template: 'order-cancelled' }];
      return [];
    }
    case 'refund.approved':
      return [{ template: 'refund-approved' }];
    case 'tenant.welcome':
      return [{ template: 'tenant-welcome' }];
    case 'auth.password_reset_requested':
      return [{ template: 'password-reset' }];
    default:
      return [];
  }
}

@Injectable()
export class OutboxDispatcherProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OutboxDispatcherProcessor.name);
  private worker: Worker<OutboxJobData> | null = null;

  constructor(
    private readonly cfg: AppConfigService,
    private readonly dispatcher: OutboxDispatcherService,
    @Inject(BULL_CONNECTION) private readonly connection: IORedis,
    @Inject(QUEUE_WEBHOOK_DELIVERY) private readonly webhookQ: Queue,
    @Inject(QUEUE_EMAIL_DELIVERY) private readonly emailQ: Queue,
  ) {}

  onModuleInit(): void {
    if (!this.cfg.workersEnabled) return;
    this.worker = new Worker<OutboxJobData>(
      QUEUE_NAMES.outboxEvents,
      async (job) => this.process(job),
      { connection: this.connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => {
      this.log.error(
        `outbox-events job ${job?.id ?? '?'} failed: ${err.message}`,
      );
    });
    this.worker.on('completed', (job) => {
      this.log.debug(`outbox-events job ${job.id} completed`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  async process(job: Job<OutboxJobData>): Promise<void> {
    const ev = job.data;
    try {
      // --- Fan out to webhooks -------------------------------------------------
      const subs = await prisma.webhookSubscription.findMany({
        where: { tenantId: ev.tenantId, isActive: true },
        select: { id: true, events: true },
      });
      const matchingSubs = subs.filter((s) =>
        this.eventMatches(ev.eventType, s.events),
      );

      for (const sub of matchingSubs) {
        const consumerName = `webhook:${sub.id}`;
        const already = await prisma.processedEvent.findUnique({
          where: {
            tenantId_consumerName_eventId: {
              tenantId: ev.tenantId,
              consumerName,
              eventId: ev.id,
            },
          },
          select: { eventId: true },
        });
        if (already) continue;
        await this.webhookQ.add(
          'deliver',
          {
            subscriptionId: sub.id,
            tenantId: ev.tenantId,
            eventId: ev.id,
            eventType: ev.eventType,
            aggregateType: ev.aggregateType,
            aggregateId: ev.aggregateId,
            payload: ev.payload,
            createdAt: ev.createdAt,
          },
          {
            jobId: `${sub.id}:${ev.id}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 30_000 }, // 30s → 1m → 2m → 4m → 8m
          },
        );
        await prisma.processedEvent.create({
          data: {
            tenantId: ev.tenantId,
            consumerName,
            eventId: ev.id,
          },
        });
      }

      // --- Fan out to email templates ----------------------------------------
      const emailTriggers = resolveEmailTriggers(ev.eventType, ev.payload);
      for (const trig of emailTriggers) {
        const consumerName = `email:${trig.template}`;
        const already = await prisma.processedEvent.findUnique({
          where: {
            tenantId_consumerName_eventId: {
              tenantId: ev.tenantId,
              consumerName,
              eventId: ev.id,
            },
          },
          select: { eventId: true },
        });
        if (already) continue;
        await this.emailQ.add(
          'send',
          {
            template: trig.template,
            tenantId: ev.tenantId,
            eventId: ev.id,
            eventType: ev.eventType,
            payload: ev.payload,
          },
          {
            jobId: `${trig.template}:${ev.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 10_000 },
          },
        );
        await prisma.processedEvent.create({
          data: {
            tenantId: ev.tenantId,
            consumerName,
            eventId: ev.id,
          },
        });
      }

      // --- Mark the outbox row published -------------------------------------
      await this.dispatcher.markPublished(ev.id);
    } catch (err) {
      const attempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? this.cfg.outboxMaxAttempts;
      const msg = (err as Error).message;
      if (attempt >= maxAttempts) {
        await this.dispatcher.markFailed(ev.id, msg);
      } else {
        await this.dispatcher.rescheduleForRetry(ev.id, 2 ** attempt * 1_000, msg);
      }
      throw err;
    }
  }

  /**
   * Match an outbox event type against a subscription's `events[]` pattern list.
   * Supports exact matches and `domain.*` wildcards (e.g. `order.*`).
   */
  private eventMatches(type: string, subscribed: string[]): boolean {
    if (subscribed.length === 0) return false;
    for (const pat of subscribed) {
      if (pat === type) return true;
      if (pat.endsWith('.*')) {
        const prefix = pat.slice(0, -2);
        if (type.startsWith(`${prefix}.`)) return true;
      }
      if (pat === '*') return true;
    }
    return false;
  }
}

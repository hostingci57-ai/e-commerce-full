import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { prisma } from '@ecf/db';
import { AppConfigService } from '../../common/config/config.service';
import {
  BULL_CONNECTION,
  QUEUE_NAMES,
} from '../../common/queue/queue.module';
import { metrics } from '../../common/metrics/metrics.registry';

export interface WebhookDeliveryJobData {
  subscriptionId: string;
  tenantId: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  createdAt: string;
  manualRetry?: boolean;
}

/**
 * Sign the body with the subscription secret. We use a timestamped format
 * (`t=<unix>,v1=<hex>`) so consumers can detect replay — a convention
 * borrowed from Stripe and well-understood by integrators.
 */
export function signWebhookPayload(
  secret: string,
  body: string,
  timestamp: number,
): string {
  const mac = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

@Injectable()
export class WebhookDeliveryProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WebhookDeliveryProcessor.name);
  private worker: Worker<WebhookDeliveryJobData> | null = null;

  constructor(
    private readonly cfg: AppConfigService,
    @Inject(BULL_CONNECTION) private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    if (!this.cfg.workersEnabled) return;
    this.worker = new Worker<WebhookDeliveryJobData>(
      QUEUE_NAMES.webhookDelivery,
      async (job) => this.deliver(job),
      { connection: this.connection, concurrency: 10 },
    );
    this.worker.on('failed', (job, err) => {
      if (!job) return;
      this.log.warn(
        `webhook delivery ${job.id} failed attempt ${job.attemptsMade}: ${err.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  async deliver(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const data = job.data;
    const sub = await prisma.webhookSubscription.findUnique({
      where: {
        tenantId_id: { tenantId: data.tenantId, id: data.subscriptionId },
      },
    });
    if (!sub) {
      // Subscription deleted mid-flight — drop silently, mark delivery row.
      await this.recordDelivery({
        ...data,
        attempt: job.attemptsMade + 1,
        statusCode: null,
        responseBody: null,
        delivered: false,
        errorMessage: 'subscription deleted',
      });
      return;
    }
    if (!sub.isActive && !data.manualRetry) {
      await this.recordDelivery({
        ...data,
        attempt: job.attemptsMade + 1,
        statusCode: null,
        responseBody: null,
        delivered: false,
        errorMessage: 'subscription inactive',
      });
      return;
    }

    const body = JSON.stringify({
      id: data.eventId,
      type: data.eventType,
      aggregateType: data.aggregateType,
      aggregateId: data.aggregateId,
      tenantId: data.tenantId,
      payload: data.payload,
      deliveredAt: new Date().toISOString(),
    });
    const timestamp = Math.floor(Date.now() / 1_000);
    const signature = signWebhookPayload(sub.secret, body, timestamp);

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.cfg.webhookTimeoutMs,
    );
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ECF-Webhook/1.0',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': data.eventType,
          'X-Webhook-Event-Id': data.eventId,
          'X-Webhook-Tenant-Id': data.tenantId,
          'X-Webhook-Timestamp': String(timestamp),
        },
        body,
        signal: controller.signal,
      });
      statusCode = res.status;
      responseBody = (await res.text()).slice(0, 4_000);
      if (!res.ok) {
        error = `HTTP ${res.status}`;
      }
    } catch (err) {
      error = (err as Error).message.slice(0, 500);
    } finally {
      clearTimeout(timer);
    }

    const delivered = error === null;
    await this.recordDelivery({
      ...data,
      attempt: job.attemptsMade + 1,
      statusCode,
      responseBody,
      delivered,
      errorMessage: error,
    });

    if (delivered) {
      metrics.webhookDeliveries.inc({
        event_type: data.eventType,
        outcome: 'success',
      });
      await prisma.webhookSubscription.update({
        where: {
          tenantId_id: { tenantId: data.tenantId, id: sub.id },
        },
        data: {
          lastSuccessAt: new Date(),
          failureCount: 0,
        },
      });
      return;
    }

    // Failure path — count failures, auto-disable if we've crossed the threshold.
    metrics.webhookDeliveries.inc({
      event_type: data.eventType,
      outcome: 'failure',
    });
    const maxAttempts = job.opts.attempts ?? 5;
    const willRetry = job.attemptsMade + 1 < maxAttempts;
    const shouldDisable =
      !willRetry &&
      sub.failureCount + 1 >= this.cfg.webhookAutoDisableThreshold;
    await prisma.webhookSubscription.update({
      where: {
        tenantId_id: { tenantId: data.tenantId, id: sub.id },
      },
      data: {
        lastFailureAt: new Date(),
        failureCount: { increment: willRetry ? 0 : 1 },
        isActive: shouldDisable ? false : sub.isActive,
      },
    });
    throw new Error(error ?? 'delivery failed');
  }

  private async recordDelivery(opts: {
    subscriptionId: string;
    tenantId: string;
    eventId: string;
    eventType: string;
    attempt: number;
    statusCode: number | null;
    responseBody: string | null;
    delivered: boolean;
    errorMessage: string | null;
  }): Promise<void> {
    await prisma.webhookDelivery.create({
      data: {
        tenantId: opts.tenantId,
        subscriptionId: opts.subscriptionId,
        eventId: opts.eventId,
        eventType: opts.eventType,
        attempt: opts.attempt,
        statusCode: opts.statusCode,
        responseBody: opts.responseBody,
        deliveredAt: opts.delivered ? new Date() : null,
        errorMessage: opts.errorMessage,
      },
    });
  }
}

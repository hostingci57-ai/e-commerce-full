import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { AppConfigService } from '../config/config.service';

/**
 * Named BullMQ queues injected across the API. Each queue is paired 1:1 with a
 * processor inside its owning module (outbox-events → OutboxDispatcherProcessor,
 * webhook-delivery → WebhookDeliveryService, etc.).
 *
 * Queue objects are *producers only*; workers are created inside OnModuleInit
 * of their owning service so Nest lifecycle owns their shutdown. All share a
 * single IORedis connection constructed here to keep Redis client count low.
 */
export const QUEUE_NAMES = {
  outboxEvents: 'outbox-events',
  webhookDelivery: 'webhook-delivery',
  emailDelivery: 'email-delivery',
  imageProcessing: 'image-processing',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const BULL_CONNECTION = Symbol('BULL_CONNECTION');
export const QUEUE_OUTBOX_EVENTS = Symbol('QUEUE_OUTBOX_EVENTS');
export const QUEUE_WEBHOOK_DELIVERY = Symbol('QUEUE_WEBHOOK_DELIVERY');
export const QUEUE_EMAIL_DELIVERY = Symbol('QUEUE_EMAIL_DELIVERY');
export const QUEUE_IMAGE_PROCESSING = Symbol('QUEUE_IMAGE_PROCESSING');

function makeConnection(cfg: AppConfigService): IORedis {
  // BullMQ requires maxRetriesPerRequest: null on the IORedis client it uses
  // for blocking commands. Use a dedicated connection rather than the shared
  // RedisModule one (which is tuned for short ops).
  const url =
    (cfg.get('REDIS_BULL_URL') as string | undefined) ?? cfg.redisUrl;
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

function makeQueue(name: QueueName, connection: IORedis): Queue {
  return new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1_000, age: 60 * 60 * 24 }, // 24h/1k
      removeOnFail: { count: 5_000, age: 60 * 60 * 24 * 7 },
    },
  });
}

@Global()
@Module({
  providers: [
    {
      provide: BULL_CONNECTION,
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService): IORedis => makeConnection(cfg),
    },
    {
      provide: QUEUE_OUTBOX_EVENTS,
      inject: [BULL_CONNECTION],
      useFactory: (connection: IORedis): Queue =>
        makeQueue(QUEUE_NAMES.outboxEvents, connection),
    },
    {
      provide: QUEUE_WEBHOOK_DELIVERY,
      inject: [BULL_CONNECTION],
      useFactory: (connection: IORedis): Queue =>
        makeQueue(QUEUE_NAMES.webhookDelivery, connection),
    },
    {
      provide: QUEUE_EMAIL_DELIVERY,
      inject: [BULL_CONNECTION],
      useFactory: (connection: IORedis): Queue =>
        makeQueue(QUEUE_NAMES.emailDelivery, connection),
    },
    {
      provide: QUEUE_IMAGE_PROCESSING,
      inject: [BULL_CONNECTION],
      useFactory: (connection: IORedis): Queue =>
        makeQueue(QUEUE_NAMES.imageProcessing, connection),
    },
  ],
  exports: [
    BULL_CONNECTION,
    QUEUE_OUTBOX_EVENTS,
    QUEUE_WEBHOOK_DELIVERY,
    QUEUE_EMAIL_DELIVERY,
    QUEUE_IMAGE_PROCESSING,
  ],
})
export class QueueModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    // Queue/Worker instances expose `close()`; Nest doesn't await useFactory
    // providers on shutdown, so we rely on processors to close their own
    // workers. Nothing to do here for now.
  }
}

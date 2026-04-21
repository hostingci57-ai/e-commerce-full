import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { prisma, type OutboxEvent } from '@ecf/db';
import { AppConfigService } from '../config/config.service';
import { QUEUE_OUTBOX_EVENTS } from '../queue/queue.module';
import { metrics } from '../metrics/metrics.registry';

/**
 * Polls `outbox_events` for `pending` rows and pushes them into the
 * `outbox-events` BullMQ queue so the dispatcher processor can fan them out
 * to webhook/email subscribers. Flip from `pending` → `publishing` is done
 * atomically with `UPDATE ... RETURNING` so two dispatchers can safely race.
 *
 * Runs in-process (same Node worker as HTTP). Can be disabled via
 * WORKERS_ENABLED=false for web-only replicas.
 */
@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OutboxDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private shutting = false;

  constructor(
    private readonly cfg: AppConfigService,
    @Inject(QUEUE_OUTBOX_EVENTS) private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    if (!this.cfg.workersEnabled) {
      this.log.log('Workers disabled (WORKERS_ENABLED=false); outbox dispatcher idle');
      return;
    }
    const interval = this.cfg.outboxDispatchIntervalMs;
    this.log.log(
      `Outbox dispatcher starting (interval=${interval}ms batch=${this.cfg.outboxDispatchBatchSize})`,
    );
    // Kick immediately then every `interval`. setInterval re-entrancy is
    // guarded by `this.running`.
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
    // Fire once at boot.
    queueMicrotask(() => void this.tick());
  }

  async onModuleDestroy(): Promise<void> {
    this.shutting = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * One dispatch tick — claims up to `batchSize` pending rows and enqueues
   * them. Exposed for tests.
   */
  async tick(): Promise<number> {
    if (this.running || this.shutting) return 0;
    this.running = true;
    try {
      const events = await this.claimPending(this.cfg.outboxDispatchBatchSize);
      if (events.length === 0) return 0;
      for (const ev of events) {
        await this.queue.add(
          'dispatch',
          {
            id: ev.id,
            tenantId: ev.tenantId,
            aggregateType: ev.aggregateType,
            aggregateId: ev.aggregateId,
            eventType: ev.eventType,
            payload: ev.payload,
            createdAt:
              ev.createdAt instanceof Date
                ? ev.createdAt.toISOString()
                : String(ev.createdAt),
          },
          {
            jobId: ev.id, // idempotent enqueue
            attempts: this.cfg.outboxMaxAttempts,
            backoff: { type: 'exponential', delay: 1_000 },
          },
        );
        metrics.outboxEventsPublished.inc({ event_type: ev.eventType });
      }
      this.log.debug(`Dispatched ${events.length} outbox event(s)`);
      return events.length;
    } catch (err) {
      this.log.error(
        `Outbox dispatch tick failed: ${(err as Error).message}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  /**
   * Atomically flips a batch of `pending`+`availableAt ≤ now` rows to
   * `publishing` and returns them. Uses a raw `UPDATE ... RETURNING` so two
   * dispatcher replicas don't double-publish the same row.
   *
   * Landlord-role Prisma is used here to bypass RLS — the dispatcher is a
   * system component operating across tenants.
   */
  private async claimPending(limit: number): Promise<OutboxEvent[]> {
    const rows = await prisma.$queryRawUnsafe<OutboxEvent[]>(
      `
        UPDATE outbox_events
        SET status = 'publishing', attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM outbox_events
          WHERE status = 'pending'
            AND "availableAt" <= now()
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        RETURNING
          id,
          "tenantId",
          "aggregateType",
          "aggregateId",
          "eventType",
          payload,
          status,
          attempts,
          "availableAt",
          "publishedAt",
          "lastError",
          "createdAt"
      `,
      limit,
    );
    return rows;
  }

  /**
   * Mark a claimed row as `published`. Called from the dispatcher processor
   * once fan-out succeeds.
   */
  async markPublished(id: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `UPDATE outbox_events
       SET status = 'published', "publishedAt" = now(), "lastError" = NULL
       WHERE id = $1`,
      id,
    );
  }

  /** Move back to `pending` with an `availableAt` delay for retry. */
  async rescheduleForRetry(id: string, delayMs: number, error: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `UPDATE outbox_events
       SET status = 'pending', "availableAt" = now() + ($2 || ' milliseconds')::interval,
           "lastError" = $3
       WHERE id = $1`,
      id,
      String(delayMs),
      error.slice(0, 2_000),
    );
  }

  /** Terminal failure (attempts exhausted). */
  async markFailed(id: string, error: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `UPDATE outbox_events
       SET status = 'failed', "lastError" = $2
       WHERE id = $1`,
      id,
      error.slice(0, 2_000),
    );
  }
}

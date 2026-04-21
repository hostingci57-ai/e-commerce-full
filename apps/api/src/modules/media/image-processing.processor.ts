import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { AppConfigService } from '../../common/config/config.service';
import {
  BULL_CONNECTION,
  QUEUE_NAMES,
} from '../../common/queue/queue.module';

/**
 * Placeholder image-resize worker. Real Sharp-backed implementation (thumbs
 * at 200x200 and 800x800) is slotted for Faz 7b. For now we log the request
 * and ack so the queue drains and upstream flow is unblocked.
 */
@Injectable()
export class ImageProcessingProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger(ImageProcessingProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly cfg: AppConfigService,
    @Inject(BULL_CONNECTION) private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    if (!this.cfg.workersEnabled) return;
    this.worker = new Worker(
      QUEUE_NAMES.imageProcessing,
      async (job: Job) => this.process(job),
      { connection: this.connection, concurrency: 2 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async process(job: Job): Promise<void> {
    this.log.debug(
      `image-processing (stub) jobId=${job.id} data=${JSON.stringify(job.data)}`,
    );
  }
}

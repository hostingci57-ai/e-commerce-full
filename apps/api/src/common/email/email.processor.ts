import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { prisma } from '@ecf/db';
import { AppConfigService } from '../config/config.service';
import {
  BULL_CONNECTION,
  QUEUE_NAMES,
} from '../queue/queue.module';
import { metrics } from '../metrics/metrics.registry';
import { ConsoleEmailProvider } from './providers/console.provider';
import { SmtpEmailProvider } from './providers/smtp.provider';
import type { EmailProvider } from './providers/email.provider.interface';
import { isKnownTemplate, renderTemplate } from './templates/registry';

interface DirectJob {
  source: 'direct';
  to: string;
  template: string;
  data: Record<string, unknown>;
  tenantId?: string;
  subjectOverride?: string;
}

interface OutboxJob {
  template: string;
  tenantId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
}

type EmailJobData = DirectJob | OutboxJob;

@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(EmailProcessor.name);
  private worker: Worker<EmailJobData> | null = null;

  constructor(
    private readonly cfg: AppConfigService,
    private readonly consoleProvider: ConsoleEmailProvider,
    private readonly smtpProvider: SmtpEmailProvider,
    @Inject(BULL_CONNECTION) private readonly connection: IORedis,
  ) {}

  private provider(): EmailProvider {
    return this.cfg.emailProvider === 'smtp'
      ? this.smtpProvider
      : this.consoleProvider;
  }

  onModuleInit(): void {
    if (!this.cfg.workersEnabled) return;
    this.worker = new Worker<EmailJobData>(
      QUEUE_NAMES.emailDelivery,
      async (job) => this.process(job),
      { connection: this.connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => {
      this.log.warn(
        `email job ${job?.id ?? '?'} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const data = job.data;
    if ('source' in data && data.source === 'direct') {
      await this.deliverDirect(data);
      return;
    }
    await this.deliverFromOutbox(data as OutboxJob);
  }

  private async deliverDirect(data: DirectJob): Promise<void> {
    if (!isKnownTemplate(data.template)) {
      throw new Error(`Unknown template: ${data.template}`);
    }
    const rendered = renderTemplate(data.template, data.data ?? {});
    const subject = data.subjectOverride ?? rendered.subject;
    try {
      await this.provider().send({
        to: data.to,
        from: this.cfg.emailFrom,
        subject,
        text: rendered.text,
        html: rendered.html,
        tenantId: data.tenantId,
      });
      metrics.emailDeliveries.inc({
        template: data.template,
        outcome: 'success',
      });
    } catch (err) {
      metrics.emailDeliveries.inc({
        template: data.template,
        outcome: 'failure',
      });
      throw err;
    }
  }

  /**
   * Outbox-sourced email — we need to hydrate the recipient (usually the
   * order customer's email) by consulting the payload and Prisma. Payloads
   * stay small so we lazy-load the customer / tenant info when needed.
   */
  private async deliverFromOutbox(data: OutboxJob): Promise<void> {
    const recipient = await this.resolveRecipient(data);
    if (!recipient) {
      this.log.debug(
        `No recipient resolved for ${data.template} (event ${data.eventId}); skipping`,
      );
      return;
    }
    const templateData = await this.buildTemplateData(data);
    const rendered = renderTemplate(data.template, templateData);
    try {
      await this.provider().send({
        to: recipient,
        from: this.cfg.emailFrom,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        tenantId: data.tenantId,
      });
      metrics.emailDeliveries.inc({
        template: data.template,
        outcome: 'success',
      });
    } catch (err) {
      metrics.emailDeliveries.inc({
        template: data.template,
        outcome: 'failure',
      });
      throw err;
    }
  }

  private async resolveRecipient(data: OutboxJob): Promise<string | null> {
    const payload = (data.payload ?? {}) as Record<string, unknown>;
    // Prefer an explicit `to` on the payload (password reset, adhoc).
    if (typeof payload.to === 'string' && payload.to.length > 0) {
      return payload.to;
    }
    const orderId = payload.orderId;
    if (typeof orderId === 'string') {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { customerId: true, guestEmail: true },
      });
      if (!order) return null;
      if (order.guestEmail) return order.guestEmail;
      if (order.customerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: order.customerId },
          select: { email: true },
        });
        return customer?.email ?? null;
      }
    }
    const customerId = payload.customerId;
    if (typeof customerId === 'string') {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { email: true },
      });
      return customer?.email ?? null;
    }
    return null;
  }

  private async buildTemplateData(
    data: OutboxJob,
  ): Promise<Record<string, unknown>> {
    const payload = (data.payload ?? {}) as Record<string, unknown>;
    const tenant = await prisma.tenant.findUnique({
      where: { id: data.tenantId },
      select: { name: true, subdomain: true },
    });
    return {
      tenantName: tenant?.name ?? 'ECF',
      subdomain: tenant?.subdomain ?? '',
      baseDomain: process.env.ECF_BASE_DOMAIN ?? 'platform.local',
      ...payload,
    };
  }
}

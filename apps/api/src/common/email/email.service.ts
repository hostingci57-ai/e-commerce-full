import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { QUEUE_EMAIL_DELIVERY } from '../queue/queue.module';
import { isKnownTemplate, renderTemplate } from './templates/registry';

export interface SendEmailInput {
  to: string;
  template: string;
  data: Record<string, unknown>;
  tenantId?: string;
  /** Override the registry subject at send time (rare). */
  subjectOverride?: string;
}

/**
 * Public façade for queuing transactional email. Callers pass a registered
 * template name + data; the processor renders and delivers asynchronously.
 */
@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);

  constructor(
    @Inject(QUEUE_EMAIL_DELIVERY) private readonly queue: Queue,
  ) {}

  async sendEmail(input: SendEmailInput): Promise<{ queued: true }> {
    if (!isKnownTemplate(input.template)) {
      throw new Error(`Unknown email template: ${input.template}`);
    }
    await this.queue.add(
      'send',
      {
        to: input.to,
        template: input.template,
        data: input.data,
        tenantId: input.tenantId,
        subjectOverride: input.subjectOverride,
        source: 'direct',
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 500, age: 60 * 60 * 24 },
      },
    );
    this.log.debug(`Queued ${input.template} → ${input.to}`);
    return { queued: true as const };
  }

  /** Pure render helper used by direct send and unit tests. */
  renderTemplate(template: string, data: Record<string, unknown>) {
    return renderTemplate(template, data);
  }
}

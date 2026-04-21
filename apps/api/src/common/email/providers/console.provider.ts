import { Injectable, Logger } from '@nestjs/common';
import type { EmailEnvelope, EmailProvider } from './email.provider.interface';

/**
 * Default "provider" for dev/test — dumps the envelope to the logger instead
 * of sending. Lets QA assert template rendering without wiring a real SMTP.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console' as const;
  private readonly log = new Logger('EmailProvider:console');

  async send(envelope: EmailEnvelope): Promise<{ providerMessageId?: string }> {
    this.log.log(
      `→ ${envelope.to} | ${envelope.subject} | tenant=${envelope.tenantId ?? '-'}`,
    );
    this.log.debug(envelope.text);
    return { providerMessageId: `console-${Date.now()}` };
  }
}

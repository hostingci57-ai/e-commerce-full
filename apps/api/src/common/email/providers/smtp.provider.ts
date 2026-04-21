import { Injectable, Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import type { EmailEnvelope, EmailProvider } from './email.provider.interface';
import { AppConfigService } from '../../config/config.service';

/**
 * SMTP provider wired to nodemailer. Disabled by default; activated when
 * EMAIL_PROVIDER=smtp and SMTP_HOST is set.
 *
 * Instance is *lazy* — we only require('nodemailer') when a send is actually
 * attempted so the module can be imported even without nodemailer installed
 * in transitive dev setups.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp' as const;
  private readonly log = new Logger('EmailProvider:smtp');
  private transporter: Transporter | null = null;

  constructor(private readonly cfg: AppConfigService) {}

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;
    const { host, port, user, pass, secure } = this.cfg.smtp;
    if (!host || !port) {
      throw new Error('SMTP_HOST and SMTP_PORT must be configured');
    }
    // Dynamic import so environments without nodemailer (CI test-only) don't
    // blow up at module load.
    const nodemailer = await import('nodemailer');
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  async send(envelope: EmailEnvelope): Promise<{ providerMessageId?: string }> {
    const transporter = await this.getTransporter();
    const info = await transporter.sendMail({
      from: envelope.from,
      to: envelope.to,
      subject: envelope.subject,
      text: envelope.text,
      html: envelope.html,
    });
    this.log.log(`Sent to ${envelope.to} (msgId=${info.messageId})`);
    return { providerMessageId: info.messageId };
  }
}

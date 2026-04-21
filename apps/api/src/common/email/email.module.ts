import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { ConsoleEmailProvider } from './providers/console.provider';
import { SmtpEmailProvider } from './providers/smtp.provider';

@Global()
@Module({
  providers: [
    EmailService,
    EmailProcessor,
    ConsoleEmailProvider,
    SmtpEmailProvider,
  ],
  exports: [EmailService],
})
export class EmailModule {}

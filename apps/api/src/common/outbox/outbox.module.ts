import { Global, Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxDispatcherProcessor } from './outbox-dispatcher.processor';
import { QueueModule } from '../queue/queue.module';

@Global()
@Module({
  imports: [QueueModule],
  providers: [
    OutboxService,
    OutboxDispatcherService,
    OutboxDispatcherProcessor,
  ],
  exports: [OutboxService, OutboxDispatcherService],
})
export class OutboxModule {}

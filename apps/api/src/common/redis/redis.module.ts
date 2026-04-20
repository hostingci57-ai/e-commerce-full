import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigService } from '../config/config.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService): Redis =>
        new Redis(cfg.redisUrl, {
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
          lazyConnect: false,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}
  async onModuleDestroy(): Promise<void> {
    /* ioredis client closes on process exit; placeholder for tests */
  }
}

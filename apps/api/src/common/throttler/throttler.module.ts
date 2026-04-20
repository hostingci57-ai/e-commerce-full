import { Global, Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RedisModule } from '../redis/redis.module';
import { RedisThrottlerStorage } from './redis-throttler-storage';

/**
 * Global rate-limiter wired to Redis so all API instances share counters.
 *
 * Default bucket: 120 requests per minute per IP (sensible default for a
 * mixed API surface). Routes that need stricter limits annotate with
 * `@Throttle({ default: { limit: N, ttl: MS } })` locally — see auth.controller
 * and checkout.controller for the tight-limits buckets.
 *
 * Per-route overrides applied in this phase:
 *   - /v1/auth/customer/login      → 5 / min
 *   - /v1/auth/staff/login         → 5 / min
 *   - /v1/auth/landlord/login      → 5 / min
 *   - /v1/auth/customer/register   → 5 / min
 *   - /v1/checkout/*               → 20 / min
 *
 * Blocked requests return 429 Too Many Requests via the default guard.
 */
@Global()
@Module({
  imports: [
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 120 },
        ],
        storage,
      }),
      inject: [RedisThrottlerStorage],
    }),
  ],
  providers: [
    RedisThrottlerStorage,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [RedisThrottlerStorage, ThrottlerModule],
})
export class AppThrottlerModule {}

import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * ThrottlerStorage backed by Redis so multiple API instances share the same
 * bucket counters. Keys expire automatically via PEXPIRE matching the `ttl`
 * supplied by the throttler. The algorithm mirrors the reference in-memory
 * storage: one INCR per hit, attached TTL on first hit, returns (totalHits,
 * timeToExpire, blockExpires).
 *
 * Block-after-exceed semantics from @nestjs/throttler v6: when the limit is
 * reached we record a `:block:<name>` companion key with blockDuration TTL so
 * subsequent requests are rejected outright for that duration.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:${throttlerName}:hit:${key}`;
    const blockKey = `throttle:${throttlerName}:block:${key}`;

    const blockPttl = await this.redis.pttl(blockKey);
    if (blockPttl > 0) {
      // Actively blocked — no increment, no TTL refresh.
      const hitPttl = await this.redis.pttl(hitKey);
      return {
        totalHits: limit + 1,
        timeToExpire: Math.max(0, Math.ceil(hitPttl / 1000)),
        isBlocked: true,
        timeToBlockExpire: Math.max(0, Math.ceil(blockPttl / 1000)),
      };
    }

    const totalHits = await this.redis.incr(hitKey);
    if (totalHits === 1) {
      await this.redis.pexpire(hitKey, ttl);
    }
    const hitPttl = await this.redis.pttl(hitKey);
    const timeToExpire = Math.max(0, Math.ceil(hitPttl / 1000));

    let isBlocked = false;
    let timeToBlockExpire = 0;

    if (totalHits > limit) {
      isBlocked = true;
      if (blockDuration > 0) {
        await this.redis.set(blockKey, '1', 'PX', blockDuration, 'NX');
        const bTtl = await this.redis.pttl(blockKey);
        timeToBlockExpire = Math.max(0, Math.ceil(bTtl / 1000));
      } else {
        timeToBlockExpire = timeToExpire;
      }
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }
}

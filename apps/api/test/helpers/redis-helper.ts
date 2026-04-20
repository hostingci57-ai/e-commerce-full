import { Redis } from 'ioredis';

/** Connect a standalone Redis client for test-only utilities. */
export function getTestRedis(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379/15';
  return new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
}

/**
 * Delete all keys matching a pattern — used to reset throttler state between
 * tests so rate-limit buckets do not bleed. Uses SCAN to avoid blocking Redis.
 */
export async function flushPattern(client: Redis, pattern: string): Promise<void> {
  const stream = client.scanStream({ match: pattern, count: 500 });
  for await (const keys of stream) {
    const batch = keys as string[];
    if (batch.length) await client.del(...batch);
  }
}

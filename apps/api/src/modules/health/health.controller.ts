import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Redis } from 'ioredis';
import type { PrismaClient } from '@ecf/db';
import { PRISMA_LANDLORD } from '../../common/prisma/prisma.module';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { Public, SkipTenancy } from '../../common/tenancy/tenancy.decorators';

@ApiTags('health')
@Controller('health')
@Public()
@SkipTenancy()
export class HealthController {
  constructor(
    @Inject(PRISMA_LANDLORD) private readonly prisma: PrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  ping(): { ok: true; service: 'api'; ts: string } {
    return { ok: true, service: 'api', ts: new Date().toISOString() };
  }

  @Get('ready')
  async ready(): Promise<Record<string, 'up' | 'down'>> {
    const [db, redis] = await Promise.all([
      this.prisma.$queryRawUnsafe('SELECT 1').then(() => 'up' as const).catch(() => 'down' as const),
      this.redis.ping().then(() => 'up' as const).catch(() => 'down' as const),
    ]);
    return { db, redis };
  }
}

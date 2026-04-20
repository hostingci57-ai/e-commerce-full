import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
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
    private readonly health: HealthCheckService,
    @Inject(PRISMA_LANDLORD) private readonly prisma: PrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Liveness — always 200 if the process is alive. */
  @Get()
  @HttpCode(HttpStatus.OK)
  liveness(): { status: 'ok'; service: 'api'; ts: string } {
    return { status: 'ok', service: 'api', ts: new Date().toISOString() };
  }

  /**
   * Readiness — checks all critical dependencies: DB, Redis, object storage.
   * Returns 503 if ANY check fails so the orchestrator can remove us from LB.
   */
  @Get('ready')
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDb(),
      () => this.checkRedis(),
      () => this.checkObjectStore(),
    ]);
  }

  /** Startup probe — true once DB migration is done (tenants table exists). */
  @Get('startup')
  @HealthCheck()
  async startup(): Promise<HealthCheckResult> {
    return this.health.check([() => this.checkMigrations()]);
  }

  // --- indicators -----------------------------------------------------------

  private async checkDb(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { db: { status: 'up' } };
    } catch (err) {
      throw new HealthCheckError('db down', {
        db: { status: 'down', message: (err as Error).message },
      });
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') throw new Error(`unexpected PING response: ${pong}`);
      return { redis: { status: 'up' } };
    } catch (err) {
      throw new HealthCheckError('redis down', {
        redis: { status: 'down', message: (err as Error).message },
      });
    }
  }

  private async checkObjectStore(): Promise<HealthIndicatorResult> {
    const endpoint = process.env.S3_ENDPOINT ?? process.env.MINIO_ENDPOINT;
    if (!endpoint) {
      // No object store configured — report skipped so readiness stays green.
      return { s3: { status: 'up', note: 'not_configured' } };
    }
    try {
      const url = endpoint.replace(/\/$/, '') + '/minio/health/live';
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return { s3: { status: 'up' } };
    } catch (err) {
      throw new HealthCheckError('s3 down', {
        s3: { status: 'down', message: (err as Error).message },
      });
    }
  }

  private async checkMigrations(): Promise<HealthIndicatorResult> {
    try {
      // A successful query against an expected table proves the migration ran.
      await this.prisma.$queryRawUnsafe('SELECT 1 FROM tenants LIMIT 1');
      return { migrations: { status: 'up' } };
    } catch (err) {
      throw new HealthCheckError('migrations pending', {
        migrations: { status: 'down', message: (err as Error).message },
      });
    }
  }
}

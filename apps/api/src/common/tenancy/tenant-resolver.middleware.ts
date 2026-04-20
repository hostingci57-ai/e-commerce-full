import { Injectable, NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import { PRISMA_LANDLORD } from '../prisma/prisma.module';
import type { PrismaClient } from '@ecf/db';
import { TenantContextService } from './tenant-context.service';
import { logger } from '../logging/logger';

/**
 * Resolves the active tenant for a request.
 *
 * Priority:
 *   1. `X-Tenant-Subdomain` header (used by internal tooling, storefront proxy)
 *   2. Host header `{subdomain}.localhost` / `{subdomain}.<root>` — production path
 *
 * Stores resolved tenant in CLS via TenantContextService. Tenant is optional at
 * this stage — auth / landlord routes may not need it; the JwtGuard/TenantGuard
 * decide what to enforce.
 *
 * Redis cache: `tenant:subdomain:{slug}` TTL 5m.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    private readonly ctx: TenantContextService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(PRISMA_LANDLORD) private readonly prismaLandlord: PrismaClient,
  ) {}

  async use(req: FastifyRequest['raw'], _res: FastifyReply['raw'], next: () => void): Promise<void> {
    // Always initialise CLS so later consumers can safely call ctx.get()
    this.ctx.init();

    const slug = this.extractSubdomain(req);
    if (!slug) {
      next();
      return;
    }

    try {
      const tenant = await this.resolveBySubdomain(slug);
      if (tenant) {
        this.ctx.setTenant({
          tenantId: tenant.id,
          subdomain: tenant.subdomain,
          status: tenant.status,
        });
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, slug }, 'tenant resolution failed');
    }
    next();
  }

  private extractSubdomain(req: FastifyRequest['raw']): string | null {
    const explicit = (req.headers['x-tenant-subdomain'] as string | undefined)?.trim();
    if (explicit) return this.sanitize(explicit);

    const host = (req.headers['host'] ?? '').split(':')[0] ?? '';
    if (!host) return null;
    const parts = host.split('.');
    // {slug}.localhost => 2 parts; {slug}.example.com => 3 parts
    if (parts.length < 2) return null;
    const candidate = parts[0];
    if (!candidate || candidate === 'www' || candidate === 'api' || candidate === 'admin') return null;
    return this.sanitize(candidate);
  }

  private sanitize(s: string): string | null {
    const clean = s.toLowerCase().trim();
    return /^[a-z0-9-]{3,30}$/.test(clean) ? clean : null;
  }

  private async resolveBySubdomain(slug: string): Promise<{
    id: string;
    subdomain: string;
    status: 'trial' | 'active' | 'suspended' | 'cancelled' | 'deleted';
  } | null> {
    const cacheKey = `tenant:subdomain:${slug}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as {
          id: string;
          subdomain: string;
          status: 'trial' | 'active' | 'suspended' | 'cancelled' | 'deleted';
        };
      } catch {
        /* fall through */
      }
    }

    const row = await this.prismaLandlord.tenant.findUnique({
      where: { subdomain: slug },
      select: { id: true, subdomain: true, status: true },
    });
    if (!row) return null;

    await this.redis
      .set(cacheKey, JSON.stringify(row), 'EX', 300)
      .catch((err) => logger.warn({ err: (err as Error).message }, 'redis tenant cache set failed'));

    return row;
  }
}

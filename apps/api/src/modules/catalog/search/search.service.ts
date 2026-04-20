import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@ecf/db';
import { withTenant } from '@ecf/db';
import { PRISMA } from '../../../common/prisma/prisma.module';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import type { SearchProductsQuery } from '@ecf/validation';

/**
 * Product full-text search.
 *
 * Preferred backend is a `search_vector` tsvector GENERATED column with a GIN
 * index (migration 0005_catalog_tsvector in the architect plan). Until that
 * migration is shipped, we fall back to ILIKE on title+description. The public
 * API shape stays identical so switching to tsvector is transparent to callers.
 *
 * When the generated column lands, swap the $queryRaw body for
 *   WHERE search_vector @@ websearch_to_tsquery('simple', $q)
 *   ORDER BY ts_rank(search_vector, websearch_to_tsquery('simple', $q)) DESC
 */
@Injectable()
export class SearchService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly ctx: TenantContextService,
  ) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) throw new NotFoundException({ code: 'tenant_required', message: 'Tenant context required' });
    return id;
  }

  async searchProducts(q: SearchProductsQuery) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const like = `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      const [items, total] = await Promise.all([
        tx.product.findMany({
          where: {
            status: 'active',
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { description: { contains: q.q, mode: 'insensitive' } },
              { slug: { contains: q.q, mode: 'insensitive' } },
            ],
          },
          orderBy: [{ updatedAt: 'desc' }],
          take: q.limit,
          skip: q.offset,
          include: { brand: true, variants: { take: 1, orderBy: { priceMinorUnits: 'asc' } } },
        }),
        tx.product.count({
          where: {
            status: 'active',
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { description: { contains: q.q, mode: 'insensitive' } },
            ],
          },
        }),
      ]);
      return { items, total, limit: q.limit, offset: q.offset, engine: 'ilike-fallback' as const, like };
    });
  }
}

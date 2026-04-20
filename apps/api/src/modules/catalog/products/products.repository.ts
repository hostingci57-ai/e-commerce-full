import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@ecf/db';
import { withTenant } from '@ecf/db';
import { PRISMA } from '../../../common/prisma/prisma.module';
import type { ListProductsQuery } from '@ecf/validation';

/**
 * Thin repository for Product aggregate reads. Writes go through
 * `withTenant(...)` directly from the service so we can open ONE transaction
 * that covers the aggregate + outbox event.
 *
 * All reads also run inside `withTenant(...)` to honour RLS at the DB boundary.
 */
@Injectable()
export class ProductsRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string) {
    return withTenant({ tenantId }, (tx) =>
      tx.product.findUnique({
        where: { id },
        include: {
          brand: true,
          variants: true,
          categories: { select: { categoryId: true, position: true } },
          media: true,
        },
      }),
    );
  }

  async list(tenantId: string, q: ListProductsQuery) {
    const where: Prisma.ProductWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.brandId) where.brandId = q.brandId;
    if (q.query) where.title = { contains: q.query, mode: 'insensitive' };
    if (q.categoryId) {
      where.categories = { some: { categoryId: q.categoryId } };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.sort === 'created_asc'
        ? { createdAt: 'asc' }
        : q.sort === 'title_asc'
          ? { title: 'asc' }
          : q.sort === 'title_desc'
            ? { title: 'desc' }
            : { createdAt: 'desc' };

    // Cursor is base64("<iso>|<id>") of the last seen product's cursor field.
    if (q.cursor) {
      try {
        const raw = Buffer.from(q.cursor, 'base64').toString('utf-8');
        const [iso, id] = raw.split('|');
        if (iso && id) {
          const dt = new Date(iso);
          const op = q.sort === 'created_asc' ? 'gt' : 'lt';
          where.AND = [
            { OR: [{ createdAt: { [op]: dt } }, { AND: [{ createdAt: dt }, { id: { [op]: id } }] }] },
          ];
        }
      } catch {
        /* invalid cursor -> ignore */
      }
    }

    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.product.findMany({
        where,
        orderBy,
        take: q.limit + 1,
        include: { brand: true, _count: { select: { variants: true } } },
      });
      const hasMore = rows.length > q.limit;
      const items = hasMore ? rows.slice(0, q.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64')
          : null;
      return { items, nextCursor, hasMore };
    });
  }
}

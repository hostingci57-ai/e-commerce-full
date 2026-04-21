import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, ReviewStatus } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  CreateReviewInput,
  ListAdminReviewsQuery,
  ListPublicReviewsQuery,
  RejectReviewInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { OutboxService } from '../../common/outbox/outbox.service';

export interface ReviewStats {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

/**
 * Product reviews — FSD 4.3 (PDP reviews) + moderation flow. Public endpoints
 * only surface APPROVED rows; verified buyers bypass PENDING because they have
 * paid skin-in-the-game (delivered order). Admin can override any state.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly outbox: OutboxService,
  ) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) throw new NotFoundException({ code: 'tenant_required', message: 'Tenant context required' });
    return id;
  }

  private requireCustomer(): { tenantId: string; customerId: string } {
    const rc = this.ctx.get();
    const tenantId = rc?.tenant?.tenantId;
    const customerId = rc?.customerId ?? null;
    if (!tenantId || !customerId) {
      throw new ForbiddenException({
        code: 'customer_auth_required',
        message: 'Customer authentication required',
      });
    }
    return { tenantId, customerId };
  }

  // -------------------------------------------------------------------------
  // Public (storefront) — create + list + stats + helpful
  // -------------------------------------------------------------------------

  async create(productId: string, input: CreateReviewInput) {
    const { tenantId, customerId } = this.requireCustomer();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, tenantId: true, title: true },
      });
      if (!product || product.tenantId !== tenantId) {
        throw new NotFoundException({ code: 'product_not_found', message: 'Product not found' });
      }

      const existing = await tx.productReview.findUnique({
        where: { tenantId_productId_customerId: { tenantId, productId, customerId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'review_already_exists',
          message: 'Bu ürün için zaten bir değerlendirme yazdınız',
        });
      }

      // Verified buyer: customer has a delivered order containing this product.
      const deliveredOrder = await tx.order.findFirst({
        where: {
          tenantId,
          customerId,
          status: 'delivered',
          lines: { some: { productId } },
        },
        select: { id: true },
        orderBy: { placedAt: 'desc' },
      });

      const isVerifiedBuyer = !!deliveredOrder;
      const status: ReviewStatus = isVerifiedBuyer ? 'APPROVED' : 'PENDING';

      const review = await tx.productReview.create({
        data: {
          tenantId,
          productId,
          customerId,
          orderId: deliveredOrder?.id ?? null,
          rating: input.rating,
          title: input.title ?? null,
          comment: input.comment ?? null,
          status,
          isVerifiedBuyer,
        },
      });

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'ProductReview',
        aggregateId: review.id,
        eventType: 'review.created',
        payload: {
          id: review.id,
          productId,
          customerId,
          rating: input.rating,
          status,
          isVerifiedBuyer,
        },
      });
      if (status === 'APPROVED') {
        await this.outbox.publish(tx, {
          tenantId,
          aggregateType: 'ProductReview',
          aggregateId: review.id,
          eventType: 'review.approved',
          payload: { id: review.id, productId, rating: input.rating, autoApproved: true },
        });
      }

      return review;
    });
  }

  async listPublic(productId: string, q: ListPublicReviewsQuery) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const where: Prisma.ProductReviewWhereInput = { tenantId, productId, status: 'APPROVED' };
      const orderBy: Prisma.ProductReviewOrderByWithRelationInput =
        q.sort === 'highest'
          ? { rating: 'desc' }
          : q.sort === 'lowest'
            ? { rating: 'asc' }
            : { createdAt: 'desc' };
      const [total, rows] = await Promise.all([
        tx.productReview.count({ where }),
        tx.productReview.findMany({
          where,
          orderBy: [orderBy, { createdAt: 'desc' }],
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        }),
      ]);

      // ProductReview has no declared relation to Customer (tenantId split
      // across composite keys) — resolve author names with a batched lookup.
      const customerIds = Array.from(new Set(rows.map((r) => r.customerId)));
      const customers = customerIds.length
        ? await tx.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
      const cmap = new Map(customers.map((c) => [c.id, c]));

      const items = rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        isVerifiedBuyer: r.isVerifiedBuyer,
        helpfulCount: r.helpfulCount,
        createdAt: r.createdAt,
        authorName: formatAuthorName(
          cmap.get(r.customerId)?.firstName ?? null,
          cmap.get(r.customerId)?.lastName ?? null,
        ),
      }));
      return {
        items,
        total,
        page: q.page,
        pageSize: q.pageSize,
        hasMore: q.page * q.pageSize < total,
      };
    });
  }

  async getStats(productId: string): Promise<ReviewStats> {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.productReview.findMany({
        where: { tenantId, productId, status: 'APPROVED' },
        select: { rating: true },
      });
      return computeStats(rows.map((r) => r.rating));
    });
  }

  async markHelpful(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.productReview.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { id: true, status: true, helpfulCount: true },
      });
      if (!existing) throw new NotFoundException({ code: 'review_not_found', message: 'Review not found' });
      if (existing.status !== 'APPROVED') {
        throw new BadRequestException({ code: 'review_not_public', message: 'Review is not publicly visible' });
      }
      return tx.productReview.update({
        where: { tenantId_id: { tenantId, id } },
        data: { helpfulCount: { increment: 1 } },
        select: { id: true, helpfulCount: true },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Admin — list / approve / reject / delete
  // -------------------------------------------------------------------------

  async listAdmin(q: ListAdminReviewsQuery) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const where: Prisma.ProductReviewWhereInput = { tenantId };
      if (q.status) where.status = q.status;
      if (q.productId) where.productId = q.productId;
      if (q.rating !== undefined) where.rating = q.rating;

      const [total, rows] = await Promise.all([
        tx.productReview.count({ where }),
        tx.productReview.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        }),
      ]);

      const customerIds = Array.from(new Set(rows.map((r) => r.customerId)));
      const productIds = Array.from(new Set(rows.map((r) => r.productId)));
      const [customers, products] = await Promise.all([
        customerIds.length
          ? tx.customer.findMany({
              where: { id: { in: customerIds } },
              select: { id: true, firstName: true, lastName: true, email: true },
            })
          : Promise.resolve([] as Array<{ id: string; firstName: string | null; lastName: string | null; email: string }>),
        productIds.length
          ? tx.product.findMany({
              where: { id: { in: productIds } },
              select: { id: true, title: true, slug: true },
            })
          : Promise.resolve([] as Array<{ id: string; title: string; slug: string }>),
      ]);
      const cmap = new Map(customers.map((c) => [c.id, c]));
      const pmap = new Map(products.map((p) => [p.id, p]));

      return {
        items: rows.map((r) => ({
          id: r.id,
          productId: r.productId,
          productTitle: pmap.get(r.productId)?.title ?? null,
          productSlug: pmap.get(r.productId)?.slug ?? null,
          customerId: r.customerId,
          customerEmail: cmap.get(r.customerId)?.email ?? null,
          customerName: formatAuthorName(
            cmap.get(r.customerId)?.firstName ?? null,
            cmap.get(r.customerId)?.lastName ?? null,
          ),
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          status: r.status,
          isVerifiedBuyer: r.isVerifiedBuyer,
          helpfulCount: r.helpfulCount,
          createdAt: r.createdAt,
        })),
        total,
        page: q.page,
        pageSize: q.pageSize,
        hasMore: q.page * q.pageSize < total,
      };
    });
  }

  async findByIdAdmin(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const row = await tx.productReview.findUnique({
        where: { tenantId_id: { tenantId, id } },
      });
      if (!row) throw new NotFoundException({ code: 'review_not_found', message: 'Review not found' });
      const [customer, product] = await Promise.all([
        tx.customer.findUnique({
          where: { id: row.customerId },
          select: { id: true, firstName: true, lastName: true, email: true },
        }),
        tx.product.findUnique({
          where: { id: row.productId },
          select: { id: true, title: true, slug: true },
        }),
      ]);
      return {
        ...row,
        customer: customer
          ? {
              id: customer.id,
              email: customer.email,
              name: formatAuthorName(customer.firstName, customer.lastName),
            }
          : null,
        product,
      };
    });
  }

  async approve(id: string) {
    return this.transition(id, 'APPROVED', 'review.approved');
  }

  async reject(id: string, input: RejectReviewInput) {
    return this.transition(id, 'REJECTED', 'review.rejected', input.reason);
  }

  /**
   * Delete a review. Staff audience with ProductReview:delete ability can
   * delete any row; customer audience can only delete their own.
   */
  async remove(id: string) {
    const tenantId = this.requireTenant();
    const rc = this.ctx.get();
    const audience = rc?.audience ?? null;
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.productReview.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { id: true, customerId: true },
      });
      if (!existing) throw new NotFoundException({ code: 'review_not_found', message: 'Review not found' });
      if (audience === 'customer') {
        if (!rc?.customerId || existing.customerId !== rc.customerId) {
          throw new ForbiddenException({ code: 'forbidden', message: 'Not your review' });
        }
      }
      await tx.productReview.delete({ where: { tenantId_id: { tenantId, id } } });
      return { id, deleted: true as const };
    });
  }

  private async transition(
    id: string,
    to: ReviewStatus,
    event: string,
    reason?: string,
  ) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.productReview.findUnique({
        where: { tenantId_id: { tenantId, id } },
      });
      if (!existing) throw new NotFoundException({ code: 'review_not_found', message: 'Review not found' });
      const updated = await tx.productReview.update({
        where: { tenantId_id: { tenantId, id } },
        data: { status: to },
      });
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'ProductReview',
        aggregateId: id,
        eventType: event,
        payload: {
          id,
          productId: existing.productId,
          from: existing.status,
          to,
          reason: reason ?? null,
        },
      });
      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function formatAuthorName(
  firstName: string | null,
  lastName: string | null,
): string {
  const fn = (firstName ?? '').trim();
  const ln = (lastName ?? '').trim();
  if (!fn && !ln) return 'Anonim';
  const lastInitial = ln ? `${ln.charAt(0).toUpperCase()}.` : '';
  return `${fn} ${lastInitial}`.trim();
}

export function computeStats(ratings: number[]): ReviewStats {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (ratings.length === 0) {
    return { average: 0, count: 0, distribution };
  }
  let sum = 0;
  for (const r of ratings) {
    const bucket = Math.min(5, Math.max(1, Math.round(r))) as 1 | 2 | 3 | 4 | 5;
    distribution[bucket] += 1;
    sum += r;
  }
  return {
    average: Math.round((sum / ratings.length) * 10) / 10,
    count: ratings.length,
    distribution,
  };
}

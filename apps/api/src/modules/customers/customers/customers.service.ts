import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  ListCustomersQuery,
  UpdateCustomerInput,
} from '@ecf/validation';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { OutboxService } from '../../../common/outbox/outbox.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly outbox: OutboxService,
  ) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) throw new NotFoundException({ code: 'tenant_required', message: 'Tenant context required' });
    return id;
  }

  async list(q: ListCustomersQuery) {
    const tenantId = this.requireTenant();

    const where: Prisma.CustomerWhereInput = {};
    if (q.query) {
      where.OR = [
        { email: { contains: q.query, mode: 'insensitive' } },
        { firstName: { contains: q.query, mode: 'insensitive' } },
        { lastName: { contains: q.query, mode: 'insensitive' } },
      ];
    }
    if (q.cursor) {
      try {
        const raw = Buffer.from(q.cursor, 'base64').toString('utf-8');
        const [iso, id] = raw.split('|');
        if (iso && id) {
          const dt = new Date(iso);
          where.AND = [
            { OR: [{ createdAt: { lt: dt } }, { AND: [{ createdAt: dt }, { id: { lt: id } }] }] },
          ];
        }
      } catch {
        /* ignore */
      }
    }

    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.customer.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: q.limit + 1,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          acceptsMarketing: true,
          createdAt: true,
        },
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

  async findById(id: string) {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId }, (tx) =>
      tx.customer.findUnique({
        where: { id },
        include: { addresses: true },
      }),
    );
    if (!row) throw new NotFoundException({ code: 'customer_not_found', message: 'Customer not found' });
    return row;
  }

  /** Admin-side update for any customer in tenant. */
  async updateById(id: string, input: UpdateCustomerInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.customer.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({ code: 'customer_not_found', message: 'Customer not found' });
      }
      return tx.customer.update({
        where: { id },
        data: {
          firstName: input.firstName ?? undefined,
          lastName: input.lastName ?? undefined,
          phone: input.phone ?? undefined,
          acceptsMarketing:
            input.acceptsMarketing === undefined ? undefined : input.acceptsMarketing,
        },
      });
    });
  }

  // --- Customer self-service (me) ------------------------------------------

  private requireSelfCustomer(): { tenantId: string; customerId: string } {
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

  async me() {
    const { tenantId, customerId } = this.requireSelfCustomer();
    const row = await withTenant({ tenantId }, (tx) =>
      tx.customer.findUnique({
        where: { id: customerId },
        include: { addresses: true },
      }),
    );
    if (!row) throw new NotFoundException({ code: 'customer_not_found', message: 'Customer not found' });
    return row;
  }

  async updateMe(input: UpdateCustomerInput) {
    const { tenantId, customerId } = this.requireSelfCustomer();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          firstName: input.firstName ?? undefined,
          lastName: input.lastName ?? undefined,
          phone: input.phone ?? undefined,
          acceptsMarketing:
            input.acceptsMarketing === undefined ? undefined : input.acceptsMarketing,
        },
      });
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Customer',
        aggregateId: customerId,
        eventType: 'customer.updated',
        payload: { id: customerId, changes: input },
      });
      return updated;
    });
  }

  /**
   * KVKK "right to be forgotten" request. We don't hard-delete rows because
   * order history must be retained for legal/financial reasons; instead we
   * clear PII and emit `customer.deletion_requested` for downstream workers
   * (anonymise orders, export-then-wipe, etc.) added in a later phase.
   */
  async deleteMeRequest() {
    const { tenantId, customerId } = this.requireSelfCustomer();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.customer.findUnique({ where: { id: customerId } });
      if (!existing) {
        throw new NotFoundException({ code: 'customer_not_found', message: 'Customer not found' });
      }
      const stamp = new Date().toISOString();
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          firstName: null,
          lastName: null,
          phone: null,
          acceptsMarketing: false,
          email: `deleted+${customerId}@deleted.local`,
          userId: null,
        },
      });
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Customer',
        aggregateId: customerId,
        eventType: 'customer.deletion_requested',
        payload: { id: customerId, requestedAt: stamp, originalEmail: existing.email },
      });
      return { id: updated.id, status: 'deleted_requested' as const, requestedAt: stamp };
    });
  }
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type { KvkkConsentInput } from '@ecf/validation';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { OutboxService } from '../../../common/outbox/outbox.service';

/**
 * KVKK / GDPR helpers (FSD 12.5.3).
 *
 * Writes are append-only (`consent_records` is a log; per-version rows are
 * retained indefinitely). `givenAt` is the audit timestamp. We stamp
 * IP + UA from CLS context where available so compliance can reconstruct the
 * consent event.
 */
@Injectable()
export class KvkkService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly outbox: OutboxService,
  ) {}

  private requireSelf(): { tenantId: string; customerId: string; userId: string | null } {
    const rc = this.ctx.get();
    const tenantId = rc?.tenant?.tenantId;
    const customerId = rc?.customerId ?? null;
    if (!tenantId || !customerId) {
      throw new ForbiddenException({
        code: 'customer_auth_required',
        message: 'Customer authentication required',
      });
    }
    return { tenantId, customerId, userId: rc?.userId ?? null };
  }

  async recordConsent(
    input: KvkkConsentInput,
    meta: { ip?: string | null; userAgent?: string | null } = {},
  ) {
    const { tenantId, customerId, userId } = this.requireSelf();
    return withTenant({ tenantId, userId: userId ?? undefined }, async (tx) => {
      // Append-only log row per consent type (one row per type per version).
      const rows = await Promise.all(
        input.consents.map((c) =>
          tx.consentRecord.create({
            data: {
              tenantId,
              customerId,
              userId: userId ?? null,
              type: `${c.type}:${c.granted ? 'granted' : 'revoked'}`,
              version: c.version,
              ipAddress: meta.ip ?? null,
              userAgent: meta.userAgent ?? null,
            },
            select: { id: true, type: true, version: true, givenAt: true },
          }),
        ),
      );

      // Mirror `acceptsMarketing` on the Customer row so storefront/admin can
      // query without joining the log.
      const marketingEmail = input.consents.find((c) => c.type === 'marketing_email');
      if (marketingEmail) {
        await tx.customer.update({
          where: { id: customerId },
          data: { acceptsMarketing: marketingEmail.granted },
        });
      }

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Customer',
        aggregateId: customerId,
        eventType: 'customer.kvkk.consent_recorded',
        payload: {
          customerId,
          consents: input.consents,
        } as Prisma.InputJsonValue,
      });

      return { recorded: rows };
    });
  }

  /**
   * KVKK data export ("right to data portability"). Returns a JSON dump of
   * everything the tenant holds about the customer. Suitable to stream back
   * as a file download at the controller layer.
   */
  async exportMyData() {
    const { tenantId, customerId } = this.requireSelf();
    return withTenant({ tenantId }, async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        include: { addresses: true },
      });
      if (!customer) {
        throw new NotFoundException({ code: 'customer_not_found', message: 'Customer not found' });
      }
      const [consents, orders] = await Promise.all([
        tx.consentRecord.findMany({
          where: { customerId },
          orderBy: { givenAt: 'asc' },
        }),
        tx.order.findMany({
          where: { customerId },
          orderBy: { placedAt: 'desc' },
          include: { lines: true },
        }),
      ]);

      return {
        exportedAt: new Date().toISOString(),
        format: 'kvkk-export/v1',
        customer,
        consents,
        orders,
      };
    });
  }
}

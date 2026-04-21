import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PrismaClient } from '@ecf/db';
import { withTenant } from '@ecf/db';
import { PRISMA_LANDLORD } from '../../common/prisma/prisma.module';
import { OutboxService } from '../../common/outbox/outbox.service';
import { EmailService } from '../../common/email/email.service';

/**
 * Daily low-stock scheduler (FSD 11).
 *
 * At 09:00 every morning we scan every tenant, pull the variants currently
 * at or below their configured `lowStockThreshold`, and:
 *
 *   1. Emit a consolidated `inventory.low_stock_digest` outbox event (so
 *      webhook subscribers can wire their own alerts).
 *   2. Queue a `low-stock-alert` email to every staff member in the tenant
 *      (OWNER + ADMIN + PRODUCT_MANAGER via tenant_members join).
 *
 * Only tenants with at least one affected variant trigger writes — quiet
 * tenants stay quiet.
 */
@Injectable()
export class LowStockSchedulerService {
  private readonly log = new Logger(LowStockSchedulerService.name);

  constructor(
    @Inject(PRISMA_LANDLORD) private readonly landlordDb: PrismaClient,
    private readonly outbox: OutboxService,
    private readonly email: EmailService,
  ) {}

  @Cron('0 9 * * *', { name: 'inventory:low-stock-daily', timeZone: 'Europe/Istanbul' })
  async runDaily(): Promise<{ tenantsChecked: number; alertsSent: number }> {
    return this.run();
  }

  /** Publicly invokable so admins can trigger manually from a CLI later. */
  async run(): Promise<{ tenantsChecked: number; alertsSent: number }> {
    const tenants = await this.landlordDb.tenant.findMany({
      where: { status: { in: ['active', 'trial'] } },
      select: { id: true, name: true, subdomain: true },
    });

    let alertsSent = 0;
    for (const t of tenants) {
      try {
        const sent = await this.runForTenant(t.id, t.name, t.subdomain);
        alertsSent += sent;
      } catch (err) {
        this.log.error(
          `Low-stock scan failed for tenant ${t.id}: ${(err as Error).message}`,
        );
      }
    }
    this.log.log(
      `Low-stock scheduler: checked ${tenants.length} tenants, sent ${alertsSent} alerts`,
    );
    return { tenantsChecked: tenants.length, alertsSent };
  }

  private async runForTenant(
    tenantId: string,
    tenantName: string,
    _subdomain: string,
  ): Promise<number> {
    const items = await withTenant({ tenantId }, async (tx) => {
      return tx.$queryRaw<
        Array<{
          variantId: string;
          sku: string;
          productTitle: string;
          stockOnHand: number;
          stockReserved: number;
          lowStockThreshold: number;
        }>
      >`
        SELECT
          l.variant_id        AS "variantId",
          v.sku               AS "sku",
          p.title             AS "productTitle",
          l.stock_on_hand     AS "stockOnHand",
          l.stock_reserved    AS "stockReserved",
          l.low_stock_threshold AS "lowStockThreshold"
        FROM inventory_levels l
        JOIN product_variants v ON v.id = l.variant_id AND v.tenant_id = l.tenant_id
        JOIN products p ON p.id = v.product_id AND p.tenant_id = l.tenant_id
        WHERE l.tenant_id = ${tenantId}::uuid
          AND (l.stock_on_hand - l.stock_reserved) <= l.low_stock_threshold
        ORDER BY (l.stock_on_hand - l.stock_reserved) ASC
        LIMIT 500
      `;
    });

    if (items.length === 0) return 0;

    const enriched = items.map((i) => ({
      ...i,
      available: i.stockOnHand - i.stockReserved,
    }));

    // 1. Outbox digest event (webhooks/analytics pickup).
    await withTenant({ tenantId }, async (tx) => {
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Inventory',
        aggregateId: tenantId,
        eventType: 'inventory.low_stock_digest',
        payload: {
          tenantId,
          itemCount: enriched.length,
          items: enriched,
        },
      });
    });

    // 2. Email the staff who care about inventory. Landlord client bypasses
    //    RLS so we can resolve the user rows without a tenant transaction.
    const members = await this.landlordDb.tenantMember.findMany({
      where: {
        tenantId,
        role: {
          code: { in: ['OWNER', 'ADMIN', 'PRODUCT_MANAGER'] },
        },
      },
      include: { user: { select: { email: true, firstName: true } } },
    });
    const recipients = Array.from(
      new Set(
        members
          .map((m) => m.user.email)
          .filter((e): e is string => Boolean(e)),
      ),
    );
    if (recipients.length === 0) {
      this.log.warn(`Tenant ${tenantId} has low stock but no staff recipients`);
      return 0;
    }

    const adminUrl = process.env.TENANT_ADMIN_URL ?? 'https://admin.example.com';
    for (const to of recipients) {
      await this.email.sendEmail({
        to,
        tenantId,
        template: 'low-stock-alert',
        data: {
          tenantName,
          itemCount: enriched.length,
          items: enriched,
          adminUrl,
        },
      });
    }
    return recipients.length;
  }
}

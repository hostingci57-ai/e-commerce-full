import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Redis } from 'ioredis';
import { prismaLandlord, withTenant } from '@ecf/db';
import type { Prisma } from '@ecf/db';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { EmailService } from '../../common/email/email.service';
import type { CartState } from '../cart/cart.types';
import { CartService, type CartOwner } from '../cart/cart.service';

interface ItemSnapshot {
  variantId: string;
  productId: string;
  sku: string;
  title: string;
  qty: number;
  priceMinor: string;
}

/** Carts are considered abandoned once untouched for this many minutes. */
const ABANDON_AFTER_MINUTES = 60;
/** Recovery email fires only once after this many hours of dormancy. */
const RECOVERY_EMAIL_AFTER_HOURS = 24;
/** Redis SCAN batch size. Keep small so the loop doesn't block the event loop. */
const SCAN_COUNT = 200;
/** Redis key pattern written by CartService — MUST stay in sync. */
const CART_KEY_PATTERN = 'cart:t:*';

/**
 * Abandoned cart detection + recovery — FSD 4.4.5.
 *
 * Approach:
 *   1) Every 15 minutes scan `cart:t:*` keys in Redis.
 *   2) For each cart untouched for >= 60 minutes with at least 1 item, upsert
 *      a row into `abandoned_carts` (unique on cartToken).
 *   3) Every 15 minutes also look for rows older than 24h that haven't been
 *      recovered or emailed — send the recovery email (once).
 *   4) CheckoutService.complete() calls `markRecovered(cartToken)` so the
 *      metric (recoveredAt) reflects completion.
 */
@Injectable()
export class AbandonedCartService implements OnModuleInit {
  private readonly log = new Logger(AbandonedCartService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly ctx: TenantContextService,
    private readonly email: EmailService,
    private readonly cart: CartService,
  ) {}

  onModuleInit(): void {
    // Prove dependencies wire up.
    this.log.log('AbandonedCartService initialized (interval scans every 15m)');
  }

  // -------------------------------------------------------------------------
  // Detection — scan Redis carts + snapshot dormant ones to Postgres
  // -------------------------------------------------------------------------

  @Interval('abandoned-cart-detect', 15 * 60 * 1000)
  async scheduledDetect(): Promise<void> {
    try {
      const result = await this.detectAndSnapshot();
      if (result.snapshotted > 0) {
        this.log.log(
          `Abandoned-cart scan: scanned=${result.scanned}, snapshotted=${result.snapshotted}`,
        );
      }
    } catch (err) {
      this.log.error(`abandoned-cart detect failed: ${(err as Error).message}`);
    }
  }

  @Interval('abandoned-cart-recover', 15 * 60 * 1000)
  async scheduledRecover(): Promise<void> {
    try {
      const sent = await this.sendRecoveryEmails();
      if (sent > 0) this.log.log(`Abandoned-cart recovery emails sent: ${sent}`);
    } catch (err) {
      this.log.error(`abandoned-cart recovery failed: ${(err as Error).message}`);
    }
  }

  async detectAndSnapshot(): Promise<{ scanned: number; snapshotted: number }> {
    let scanned = 0;
    let snapshotted = 0;
    const cutoffMs = Date.now() - ABANDON_AFTER_MINUTES * 60 * 1000;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        CART_KEY_PATTERN,
        'COUNT',
        SCAN_COUNT,
      );
      cursor = nextCursor;
      if (keys.length === 0) continue;

      const values = await this.redis.mget(...keys);
      for (let i = 0; i < keys.length; i += 1) {
        scanned += 1;
        const raw = values[i];
        if (!raw) continue;
        let state: CartState;
        try {
          state = JSON.parse(raw) as CartState;
        } catch {
          continue;
        }
        if (!state.items || state.items.length === 0) continue;
        const updatedAt = Date.parse(state.updatedAt ?? state.createdAt ?? '');
        if (!Number.isFinite(updatedAt) || updatedAt > cutoffMs) continue;
        await this.snapshotOne(keys[i], state).catch((err) => {
          this.log.warn(`snapshot failed for ${keys[i]}: ${(err as Error).message}`);
        });
        snapshotted += 1;
      }
    } while (cursor !== '0');

    return { scanned, snapshotted };
  }

  private async snapshotOne(cartKey: string, state: CartState): Promise<void> {
    const cartToken = cartKey; // full key is the natural identifier (unique per tenant).
    const itemsSnapshot: ItemSnapshot[] = state.items.map((i) => ({
      variantId: i.variantId,
      productId: i.productId,
      sku: i.sku,
      title: i.title,
      qty: i.quantity,
      priceMinor: i.priceMinor,
    }));
    const totalAmount = state.items.reduce(
      (acc, l) => acc + BigInt(l.priceMinor) * BigInt(l.quantity),
      0n,
    );
    const currency = state.currency ?? 'TRY';

    let customerEmail: string | null = null;
    if (state.customerId) {
      await withTenant({ tenantId: state.tenantId }, async (tx) => {
        const c = await tx.customer.findUnique({
          where: { id: state.customerId! },
          select: { email: true },
        });
        customerEmail = c?.email ?? null;
      });
    }

    await withTenant({ tenantId: state.tenantId }, async (tx) => {
      // Upsert by (tenantId, cartToken) — repeated scans should NOT clobber
      // a previously-sent recoveryEmailSentAt flag.
      await tx.abandonedCart.upsert({
        where: { tenantId_cartToken: { tenantId: state.tenantId, cartToken } },
        update: {
          itemsSnapshot: itemsSnapshot as unknown as Prisma.InputJsonValue,
          totalAmount,
          currency,
          customerId: state.customerId ?? null,
          customerEmail,
        },
        create: {
          tenantId: state.tenantId,
          cartToken,
          customerId: state.customerId ?? null,
          customerEmail,
          itemsSnapshot: itemsSnapshot as unknown as Prisma.InputJsonValue,
          totalAmount,
          currency,
        },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Recovery email
  // -------------------------------------------------------------------------

  async sendRecoveryEmails(): Promise<number> {
    // Landlord-side cross-tenant scan — bypasses RLS to find due recoveries
    // across every tenant in one pass.
    const tenants = await prismaLandlord.abandonedCart.findMany({
      where: {
        recoveryEmailSentAt: null,
        recoveredAt: null,
        customerEmail: { not: null },
        createdAt: { lte: new Date(Date.now() - RECOVERY_EMAIL_AFTER_HOURS * 60 * 60 * 1000) },
      },
      select: {
        tenantId: true,
        id: true,
        cartToken: true,
        customerEmail: true,
        itemsSnapshot: true,
        totalAmount: true,
        currency: true,
      },
      take: 50,
    });

    if (tenants.length === 0) return 0;
    const storefrontBase = resolveStorefrontBase();

    let sent = 0;
    for (const row of tenants) {
      if (!row.customerEmail) continue;
      const items = (Array.isArray(row.itemsSnapshot) ? row.itemsSnapshot : []) as unknown as ItemSnapshot[];
      const totalMinor = BigInt(row.totalAmount as unknown as string | number | bigint);
      const resumeUrl = `${storefrontBase.replace(/\/$/, '')}/cart?recover=${encodeURIComponent(row.cartToken)}`;

      try {
        await this.email.sendEmail({
          template: 'abandoned-cart-recovery',
          to: row.customerEmail,
          tenantId: row.tenantId,
          data: {
            items: items.map((i) => ({
              title: i.title,
              qty: i.qty,
              price: formatMoney(BigInt(i.priceMinor) * BigInt(i.qty), row.currency),
            })),
            total: formatMoney(totalMinor, row.currency),
            currency: row.currency,
            resumeUrl,
          },
        });
        await withTenant({ tenantId: row.tenantId }, (tx) =>
          tx.abandonedCart.update({
            where: { tenantId_id: { tenantId: row.tenantId, id: row.id } },
            data: { recoveryEmailSentAt: new Date() },
          }),
        );
        sent += 1;
      } catch (err) {
        this.log.warn(`recovery email failed for ${row.customerEmail}: ${(err as Error).message}`);
      }
    }
    return sent;
  }

  async markRecovered(tenantId: string, cartToken: string): Promise<void> {
    await withTenant({ tenantId }, async (tx) => {
      await tx.abandonedCart.updateMany({
        where: { tenantId, cartToken, recoveredAt: null },
        data: { recoveredAt: new Date() },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Admin-facing
  // -------------------------------------------------------------------------

  async list(params: { recovered?: boolean; limit?: number; cursor?: string | null } = {}) {
    const tenantId = this.requireTenant();
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    return withTenant({ tenantId }, async (tx) => {
      const where: Prisma.AbandonedCartWhereInput = { tenantId };
      if (params.recovered === true) where.recoveredAt = { not: null };
      if (params.recovered === false) where.recoveredAt = null;

      if (params.cursor) {
        try {
          const [iso, id] = Buffer.from(params.cursor, 'base64').toString('utf-8').split('|');
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
      const rows = await tx.abandonedCart.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64')
          : null;
      return {
        items: items.map((r) => ({
          id: r.id,
          cartToken: r.cartToken,
          customerId: r.customerId,
          customerEmail: r.customerEmail,
          itemsSnapshot: r.itemsSnapshot,
          totalAmount: r.totalAmount.toString(),
          currency: r.currency,
          recoveredAt: r.recoveredAt,
          recoveryEmailSentAt: r.recoveryEmailSentAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        nextCursor,
        hasMore,
      };
    });
  }

  async sendManualRecovery(id: string): Promise<{ id: string; sent: boolean }> {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId }, (tx) =>
      tx.abandonedCart.findUnique({ where: { tenantId_id: { tenantId, id } } }),
    );
    if (!row) throw new NotFoundException({ code: 'abandoned_cart_not_found', message: 'Not found' });
    if (!row.customerEmail) {
      throw new BadRequestException({ code: 'no_email', message: 'Cart has no customer email on file' });
    }
    const items = (Array.isArray(row.itemsSnapshot) ? row.itemsSnapshot : []) as unknown as ItemSnapshot[];
    const totalMinor = BigInt(row.totalAmount as unknown as string | number | bigint);
    const storefrontBase = resolveStorefrontBase();
    const resumeUrl = `${storefrontBase.replace(/\/$/, '')}/cart?recover=${encodeURIComponent(row.cartToken)}`;

    await this.email.sendEmail({
      template: 'abandoned-cart-recovery',
      to: row.customerEmail,
      tenantId,
      data: {
        items: items.map((i) => ({
          title: i.title,
          qty: i.qty,
          price: formatMoney(BigInt(i.priceMinor) * BigInt(i.qty), row.currency),
        })),
        total: formatMoney(totalMinor, row.currency),
        currency: row.currency,
        resumeUrl,
      },
    });
    await withTenant({ tenantId }, (tx) =>
      tx.abandonedCart.update({
        where: { tenantId_id: { tenantId, id } },
        data: { recoveryEmailSentAt: new Date() },
      }),
    );
    return { id, sent: true };
  }

  /**
   * 24h metric consumed by analytics — non-recovered abandoned carts created
   * in the last 24h. Read-only, no side effects.
   */
  async countRecent24h(): Promise<number> {
    const tenantId = this.requireTenant();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return withTenant({ tenantId }, (tx) =>
      tx.abandonedCart.count({
        where: { tenantId, recoveredAt: null, createdAt: { gte: since } },
      }),
    );
  }

  // -------------------------------------------------------------------------
  // Resume (storefront callback — POST /v1/cart/recover/:cartToken)
  // -------------------------------------------------------------------------

  /**
   * Load the stored items snapshot into the caller's cart (guest or member).
   * The storefront sends the original cartToken from the recovery email query
   * param; the caller's active cart_token cookie identifies where to load it.
   */
  async resumeForCurrentCart(params: {
    tenantId: string;
    recoverToken: string;
    activeCartToken: string | null;
  }): Promise<{ recovered: boolean; items: number }> {
    const { tenantId, recoverToken } = params;
    const row = await withTenant({ tenantId }, (tx) =>
      tx.abandonedCart.findUnique({
        where: { tenantId_cartToken: { tenantId, cartToken: recoverToken } },
      }),
    );
    if (!row) throw new NotFoundException({ code: 'abandoned_cart_not_found', message: 'Token not found' });
    if (row.recoveredAt) {
      return { recovered: false, items: 0 };
    }
    const items = (Array.isArray(row.itemsSnapshot) ? row.itemsSnapshot : []) as unknown as ItemSnapshot[];
    if (items.length === 0) return { recovered: false, items: 0 };

    const owner: CartOwner = this.cart.resolveOwner(params.activeCartToken);
    let added = 0;
    for (const it of items) {
      try {
        await this.cart.addItem(owner, it.variantId, it.qty);
        added += it.qty;
      } catch (err) {
        this.log.warn(`resume add failed ${it.variantId}: ${(err as Error).message}`);
      }
    }
    return { recovered: added > 0, items: added };
  }

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) throw new NotFoundException({ code: 'tenant_required', message: 'Tenant context required' });
    return id;
  }
}

function formatMoney(minor: bigint, currency: string): string {
  const units = Number(minor) / 100;
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(units);
  } catch {
    return `${units.toFixed(2)} ${currency}`;
  }
}

function resolveStorefrontBase(): string {
  return (
    process.env.STOREFRONT_BASE_URL ??
    process.env.NEXT_PUBLIC_STOREFRONT_URL ??
    'http://localhost:3000'
  );
}

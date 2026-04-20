import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  CreateCouponInput,
  ListCouponsQuery,
  UpdateCouponInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import type {
  CartForCoupon,
  CouponRow,
  CouponValidationResult,
  CustomerContextForCoupon,
} from './coupons.types';

/**
 * Coupons engine — FSD 4.4.3 + 15.
 *
 * Pure evaluation lives in `evaluate()` and operates on plain value objects so
 * it can be unit-tested without a DB. `validateAndCalculate()` is the
 * production entrypoint that loads the coupon, counts customer redemptions,
 * and defers to `evaluate()`.
 */
@Injectable()
export class CouponsService {
  constructor(private readonly ctx: TenantContextService) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) {
      throw new NotFoundException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return id;
  }

  // -------------------------------------------------------------------------
  // Admin CRUD
  // -------------------------------------------------------------------------

  async create(input: CreateCouponInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const normalizedCode = input.code.toUpperCase();
      const dupe = await tx.coupon.findUnique({
        where: { tenantId_code: { tenantId, code: normalizedCode } },
        select: { id: true },
      });
      if (dupe) {
        throw new ConflictException({
          code: 'coupon_code_taken',
          message: `Code "${normalizedCode}" is already in use`,
        });
      }
      return tx.coupon.create({
        data: {
          tenantId,
          code: normalizedCode,
          type: input.type,
          value: input.value,
          minimumAmount: input.minimumAmount ?? null,
          maximumDiscount: input.maximumDiscount ?? null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          usageLimit: input.usageLimit ?? null,
          usageLimitPerCustomer: input.usageLimitPerCustomer ?? null,
          stackable: input.stackable ?? false,
          isActive: input.isActive ?? true,
          customerGroupIds: input.customerGroupIds ?? [],
          categoryIds: input.categoryIds ?? [],
          productIds: input.productIds ?? [],
        },
      });
    });
  }

  async list(q: ListCouponsQuery) {
    const tenantId = this.requireTenant();
    const where: Prisma.CouponWhereInput = {};
    if (typeof q.isActive === 'boolean') where.isActive = q.isActive;
    if (q.query) {
      where.code = { contains: q.query.toUpperCase(), mode: 'insensitive' };
    }
    if (q.cursor) {
      try {
        const [iso, id] = Buffer.from(q.cursor, 'base64')
          .toString('utf-8')
          .split('|');
        if (iso && id) {
          const dt = new Date(iso);
          where.AND = [
            {
              OR: [
                { createdAt: { lt: dt } },
                { AND: [{ createdAt: dt }, { id: { lt: id } }] },
              ],
            },
          ];
        }
      } catch {
        /* ignore malformed cursor */
      }
    }
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.coupon.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
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
      tx.coupon.findUnique({ where: { id } }),
    );
    if (!row) {
      throw new NotFoundException({
        code: 'coupon_not_found',
        message: 'Coupon not found',
      });
    }
    return row;
  }

  async update(id: string, input: UpdateCouponInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.coupon.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({
          code: 'coupon_not_found',
          message: 'Coupon not found',
        });
      }
      const normalizedCode = input.code ? input.code.toUpperCase() : undefined;
      if (normalizedCode && normalizedCode !== existing.code) {
        const dupe = await tx.coupon.findUnique({
          where: { tenantId_code: { tenantId, code: normalizedCode } },
        });
        if (dupe && dupe.id !== id) {
          throw new ConflictException({
            code: 'coupon_code_taken',
            message: `Code "${normalizedCode}" is already in use`,
          });
        }
      }
      return tx.coupon.update({
        where: { id },
        data: {
          code: normalizedCode,
          type: input.type,
          value: input.value,
          minimumAmount: input.minimumAmount ?? undefined,
          maximumDiscount: input.maximumDiscount ?? undefined,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
          usageLimit: input.usageLimit ?? undefined,
          usageLimitPerCustomer: input.usageLimitPerCustomer ?? undefined,
          stackable: input.stackable,
          isActive: input.isActive,
          customerGroupIds: input.customerGroupIds,
          categoryIds: input.categoryIds,
          productIds: input.productIds,
        },
      });
    });
  }

  /** Soft-delete → `isActive=false`. Preserves historical redemptions. */
  async softDelete(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.coupon.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({
          code: 'coupon_not_found',
          message: 'Coupon not found',
        });
      }
      return tx.coupon.update({
        where: { id },
        data: { isActive: false },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Validation + calculation (engine)
  // -------------------------------------------------------------------------

  /**
   * Look the coupon up by code, enrich with per-customer redemption count,
   * then run the pure `evaluate()` check against the current cart.
   */
  async validateAndCalculate(
    code: string,
    cart: CartForCoupon,
    customer: CustomerContextForCoupon,
  ): Promise<CouponValidationResult> {
    const tenantId = this.requireTenant();
    const normalizedCode = code.trim().toUpperCase();
    return withTenant({ tenantId }, async (tx) => {
      const coupon = await tx.coupon.findUnique({
        where: { tenantId_code: { tenantId, code: normalizedCode } },
      });
      if (!coupon) {
        return {
          valid: false,
          discountMinor: 0n,
          reason: 'coupon_not_found',
        } satisfies CouponValidationResult;
      }
      let customerRedemptionCount = 0;
      if (customer.customerId && coupon.usageLimitPerCustomer) {
        customerRedemptionCount = await tx.couponRedemption.count({
          where: { couponId: coupon.id, customerId: customer.customerId },
        });
      }
      return CouponsService.evaluate(
        coupon as unknown as CouponRow,
        cart,
        customer,
        { customerRedemptionCount, now: new Date() },
      );
    });
  }

  /**
   * Pure evaluation. Exposed as a static so tests can feed handcrafted value
   * objects without Prisma.
   */
  static evaluate(
    coupon: CouponRow,
    cart: CartForCoupon,
    customer: CustomerContextForCoupon,
    opts: { customerRedemptionCount: number; now: Date },
  ): CouponValidationResult {
    if (!coupon.isActive) {
      return { valid: false, discountMinor: 0n, reason: 'coupon_inactive' };
    }
    if (coupon.startsAt && opts.now < coupon.startsAt) {
      return { valid: false, discountMinor: 0n, reason: 'coupon_not_yet_started' };
    }
    if (coupon.endsAt && opts.now > coupon.endsAt) {
      return { valid: false, discountMinor: 0n, reason: 'coupon_expired' };
    }
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, discountMinor: 0n, reason: 'coupon_usage_limit_reached' };
    }
    if (
      coupon.usageLimitPerCustomer !== null &&
      opts.customerRedemptionCount >= coupon.usageLimitPerCustomer
    ) {
      return { valid: false, discountMinor: 0n, reason: 'coupon_customer_limit_reached' };
    }
    if (cart.items.length === 0) {
      return { valid: false, discountMinor: 0n, reason: 'coupon_cart_empty' };
    }
    if (
      coupon.minimumAmount !== null &&
      cart.subtotalMinor < coupon.minimumAmount
    ) {
      return {
        valid: false,
        discountMinor: 0n,
        reason: 'coupon_minimum_amount_not_met',
      };
    }
    if (coupon.customerGroupIds.length > 0) {
      const groups = customer.customerGroupIds ?? [];
      if (!coupon.customerGroupIds.some((id) => groups.includes(id))) {
        return {
          valid: false,
          discountMinor: 0n,
          reason: 'coupon_customer_group_mismatch',
        };
      }
    }
    if (coupon.productIds.length > 0) {
      const cartProductIds = new Set(cart.items.map((i) => i.productId));
      if (!coupon.productIds.some((id) => cartProductIds.has(id))) {
        return {
          valid: false,
          discountMinor: 0n,
          reason: 'coupon_product_scope_mismatch',
        };
      }
    }
    if (coupon.categoryIds.length > 0) {
      const cartCategoryIds = new Set(
        cart.items.flatMap((i) => i.categoryIds ?? []),
      );
      if (!coupon.categoryIds.some((id) => cartCategoryIds.has(id))) {
        return {
          valid: false,
          discountMinor: 0n,
          reason: 'coupon_category_scope_mismatch',
        };
      }
    }

    // Calculate discount amount per coupon type.
    let discount = 0n;
    if (coupon.type === 'PERCENT') {
      // basis points: value is 1..10000 meaning %0.01..%100
      discount = (cart.subtotalMinor * coupon.value) / 10000n;
    } else if (coupon.type === 'FIXED') {
      discount = coupon.value;
    } else if (coupon.type === 'FREE_SHIPPING') {
      discount = cart.shippingMinor ?? 0n;
    }

    // maximumDiscount cap — independent from type (a safety net).
    if (coupon.maximumDiscount !== null && discount > coupon.maximumDiscount) {
      discount = coupon.maximumDiscount;
    }
    // Never discount more than subtotal — for non-shipping coupons.
    if (coupon.type !== 'FREE_SHIPPING' && discount > cart.subtotalMinor) {
      discount = cart.subtotalMinor;
    }

    return {
      valid: true,
      discountMinor: discount,
      couponId: coupon.id,
      couponType: coupon.type,
    };
  }

  // -------------------------------------------------------------------------
  // Redemption (called from CheckoutService.complete)
  // -------------------------------------------------------------------------

  /**
   * Record a redemption + atomically increment usage count. Call inside the
   * caller's Prisma transaction so the redemption is linked to order creation.
   *
   * We use a raw UPDATE with `usage_count < usage_limit OR usage_limit IS NULL`
   * so the atomicity holds even when two checkouts race on the last redemption.
   */
  async redeem(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      couponId: string;
      orderId: string;
      customerId: string | null;
      discountApplied: bigint;
    },
  ): Promise<void> {
    const updated = await tx.$executeRaw`
      UPDATE coupons
         SET usage_count = usage_count + 1
       WHERE id = ${params.couponId}::uuid
         AND tenant_id = ${params.tenantId}::uuid
         AND is_active = true
         AND (usage_limit IS NULL OR usage_count < usage_limit)
    `;
    if (updated === 0) {
      throw new BadRequestException({
        code: 'coupon_usage_limit_reached',
        message: 'Coupon usage limit exhausted',
      });
    }
    await tx.couponRedemption.create({
      data: {
        tenantId: params.tenantId,
        couponId: params.couponId,
        orderId: params.orderId,
        customerId: params.customerId,
        discountApplied: params.discountApplied,
      },
    });
  }
}

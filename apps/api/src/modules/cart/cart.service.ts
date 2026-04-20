import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { withTenant } from '@ecf/db';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { metrics } from '../../common/metrics/metrics.registry';
import { CouponsService } from '../coupons/coupons.service';
import type { CartForCoupon } from '../coupons/coupons.types';
import type { CartCoupon, CartLine, CartState, CartTotals, CartView } from './cart.types';

/** Guest carts are purged 30d after last touch; member carts live until cleared. */
const GUEST_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Redis key shapes. Multi-tenant: tenantId is part of every key so keyspace
 * collisions across tenants are impossible at the protocol level.
 *
 *   cart:t:{tenantId}:g:{cartToken}          guest owner (cart_token cookie)
 *   cart:t:{tenantId}:c:{customerId}         member owner (1 cart per customer)
 */
function guestKey(tenantId: string, cartToken: string): string {
  return `cart:t:${tenantId}:g:${cartToken}`;
}
function memberKey(tenantId: string, customerId: string): string {
  return `cart:t:${tenantId}:c:${customerId}`;
}

export interface CartOwner {
  tenantId: string;
  /** Null when the owner is a guest (cart_token cookie). */
  customerId: string | null;
  /** Cart-token cookie value; required when customerId is null. */
  cartToken: string | null;
}

@Injectable()
export class CartService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly ctx: TenantContextService,
    private readonly couponsService: CouponsService,
  ) {}

  // -------------------------------------------------------------------------
  // Owner resolution
  // -------------------------------------------------------------------------

  /**
   * Build the cart owner descriptor from request context. Prefers
   * authenticated customer, falls back to the `cart_token` cookie middleware
   * has placed on the request.
   */
  resolveOwner(cartToken: string | null | undefined): CartOwner {
    const rc = this.ctx.get();
    const tenantId = rc?.tenant?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    const customerId = rc?.audience === 'customer' ? (rc.customerId ?? null) : null;
    if (!customerId && !cartToken) {
      throw new BadRequestException({
        code: 'cart_token_required',
        message: 'Cart token cookie is required for guest carts',
      });
    }
    return { tenantId, customerId, cartToken: customerId ? null : cartToken! };
  }

  private keyFor(owner: CartOwner): string {
    if (owner.customerId) return memberKey(owner.tenantId, owner.customerId);
    return guestKey(owner.tenantId, owner.cartToken!);
  }

  // -------------------------------------------------------------------------
  // Load / persist
  // -------------------------------------------------------------------------

  async load(owner: CartOwner): Promise<CartView> {
    const key = this.keyFor(owner);
    const raw = await this.redis.get(key);
    const state: CartState = raw
      ? (JSON.parse(raw) as CartState)
      : this.empty(owner, key);
    return this.withTotals(state);
  }

  private empty(owner: CartOwner, key: string): CartState {
    const now = new Date().toISOString();
    return {
      ownerKey: key,
      cartId: randomUUID(),
      tenantId: owner.tenantId,
      customerId: owner.customerId,
      items: [],
      coupons: [],
      currency: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async save(state: CartState, owner: CartOwner): Promise<void> {
    const key = this.keyFor(owner);
    state.ownerKey = key;
    state.updatedAt = new Date().toISOString();
    const body = JSON.stringify(state);
    if (owner.customerId) {
      await this.redis.set(key, body);
    } else {
      await this.redis.set(key, body, 'EX', GUEST_TTL_SECONDS);
    }
  }

  private withTotals(state: CartState): CartView {
    const totals = this.computeTotals(state);
    return { ...state, totals };
  }

  private computeTotals(state: CartState): CartTotals {
    let subtotal = 0n;
    let itemCount = 0;
    for (const line of state.items) {
      subtotal += BigInt(line.priceMinor) * BigInt(line.quantity);
      itemCount += line.quantity;
    }
    let discount = 0n;
    for (const c of state.coupons) {
      discount += BigInt(c.discountMinor);
    }
    if (discount > subtotal) discount = subtotal;
    return {
      subtotalMinor: subtotal,
      discountMinor: discount,
      totalMinor: subtotal - discount,
      itemCount,
      currency: state.currency,
    };
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async addItem(
    owner: CartOwner,
    variantId: string,
    quantity: number,
  ): Promise<CartView> {
    // RLS: run the variant lookup inside withTenant so app.current_tenant_id
    // is set and RLS predicates pass (the `tenantId !== owner.tenantId`
    // defense-in-depth check then stays meaningful).
    const variant = await withTenant(
      { tenantId: owner.tenantId, userId: this.ctx.userId },
      (tx) =>
        tx.productVariant.findUnique({
          where: { id: variantId },
          select: {
            id: true,
            tenantId: true,
            productId: true,
            sku: true,
            priceMinorUnits: true,
            currency: true,
            stockOnHand: true,
            stockReserved: true,
            product: { select: { title: true, status: true } },
          },
        }),
    );
    if (!variant || variant.tenantId !== owner.tenantId) {
      throw new NotFoundException({ code: 'variant_not_found', message: 'Variant not found' });
    }
    if (variant.product.status !== 'active') {
      throw new BadRequestException({
        code: 'variant_unavailable',
        message: 'Product is not available for purchase',
      });
    }

    const state = (await this.loadStateForWrite(owner)) ?? this.empty(owner, this.keyFor(owner));
    const existing = state.items.find((i) => i.variantId === variantId);
    const desiredQty = (existing?.quantity ?? 0) + quantity;
    const available = variant.stockOnHand - variant.stockReserved;
    if (desiredQty > available) {
      throw new BadRequestException({
        code: 'out_of_stock',
        message: `Only ${available} units available`,
      });
    }

    // Enforce single-currency cart — if mismatched, reset coupons + switch.
    if (state.currency && state.currency !== variant.currency) {
      throw new BadRequestException({
        code: 'currency_mismatch',
        message: `Cart currency is ${state.currency}; variant priced in ${variant.currency}`,
      });
    }
    state.currency = variant.currency;

    if (existing) {
      existing.quantity = desiredQty;
    } else {
      state.items.push({
        variantId: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        title: variant.product.title,
        currency: variant.currency,
        priceMinor: variant.priceMinorUnits.toString(),
        quantity,
        addedAt: new Date().toISOString(),
      } satisfies CartLine);
    }

    await this.save(state, owner);
    metrics.cartOperations.inc({ op: 'add' });
    return this.withTotals(state);
  }

  async updateQuantity(
    owner: CartOwner,
    variantId: string,
    quantity: number,
  ): Promise<CartView> {
    const state = await this.loadStateForWrite(owner);
    if (!state) throw new NotFoundException({ code: 'cart_not_found', message: 'Cart not found' });

    const line = state.items.find((i) => i.variantId === variantId);
    if (!line) {
      throw new NotFoundException({ code: 'cart_line_not_found', message: 'Line not in cart' });
    }
    const variant = await withTenant(
      { tenantId: owner.tenantId, userId: this.ctx.userId },
      (tx) =>
        tx.productVariant.findUnique({
          where: { id: variantId },
          select: { tenantId: true, stockOnHand: true, stockReserved: true },
        }),
    );
    if (!variant || variant.tenantId !== owner.tenantId) {
      throw new NotFoundException({ code: 'variant_not_found', message: 'Variant not found' });
    }
    const available = variant.stockOnHand - variant.stockReserved;
    if (quantity > available) {
      throw new BadRequestException({
        code: 'out_of_stock',
        message: `Only ${available} units available`,
      });
    }
    line.quantity = quantity;
    await this.save(state, owner);
    metrics.cartOperations.inc({ op: 'update' });
    return this.withTotals(state);
  }

  async removeItem(owner: CartOwner, variantId: string): Promise<CartView> {
    const state = await this.loadStateForWrite(owner);
    if (!state) return this.withTotals(this.empty(owner, this.keyFor(owner)));
    state.items = state.items.filter((i) => i.variantId !== variantId);
    if (state.items.length === 0) state.currency = null;
    await this.save(state, owner);
    metrics.cartOperations.inc({ op: 'remove' });
    return this.withTotals(state);
  }

  async clear(owner: CartOwner): Promise<void> {
    await this.redis.del(this.keyFor(owner));
    metrics.cartOperations.inc({ op: 'clear' });
  }

  // -------------------------------------------------------------------------
  // Coupons — see CouponsService for the evaluation engine.
  // -------------------------------------------------------------------------

  async applyCoupon(owner: CartOwner, code: string): Promise<CartView> {
    const state = (await this.loadStateForWrite(owner)) ?? this.empty(owner, this.keyFor(owner));
    if (state.items.length === 0) {
      throw new BadRequestException({
        code: 'cart_empty',
        message: 'Cannot apply a coupon to an empty cart',
      });
    }
    const normalized = code.trim().toUpperCase();
    const already = state.coupons.find((c) => c.code === normalized);
    if (already) {
      throw new BadRequestException({
        code: 'coupon_already_applied',
        message: `Coupon ${normalized} is already applied`,
      });
    }
    // Build the pure-evaluation input from Redis cart state.
    let subtotal = 0n;
    for (const line of state.items) {
      subtotal += BigInt(line.priceMinor) * BigInt(line.quantity);
    }
    const cartInput: CartForCoupon = {
      subtotalMinor: subtotal,
      currency: state.currency ?? 'TRY',
      items: state.items.map((i) => ({
        variantId: i.variantId,
        productId: i.productId,
        quantity: i.quantity,
        priceMinor: i.priceMinor,
      })),
    };
    const result = await this.couponsService.validateAndCalculate(normalized, cartInput, {
      customerId: owner.customerId,
    });
    if (!result.valid) {
      throw new BadRequestException({
        code: result.reason ?? 'coupon_invalid',
        message: `Coupon ${normalized} is not applicable`,
      });
    }
    // Stackable check — reject if adding to a non-stackable set.
    if (state.coupons.length > 0) {
      throw new BadRequestException({
        code: 'coupon_not_stackable',
        message: 'Only one coupon can be applied at a time in this release',
      });
    }
    state.coupons.push({
      code: normalized,
      discountMinor: result.discountMinor.toString(),
      appliedAt: new Date().toISOString(),
    });
    await this.save(state, owner);
    metrics.cartOperations.inc({ op: 'coupon_apply' });
    return this.withTotals(state);
  }

  async removeCoupon(owner: CartOwner, code: string): Promise<CartView> {
    const state = await this.loadStateForWrite(owner);
    if (!state) return this.withTotals(this.empty(owner, this.keyFor(owner)));
    const normalized = code.trim().toUpperCase();
    state.coupons = state.coupons.filter(
      (c: CartCoupon) => c.code !== normalized && c.code !== code,
    );
    await this.save(state, owner);
    metrics.cartOperations.inc({ op: 'coupon_remove' });
    return this.withTotals(state);
  }

  // -------------------------------------------------------------------------
  // Merge (on login: guest cart → member cart)
  // -------------------------------------------------------------------------

  async merge(
    memberOwner: CartOwner,
    guestCartToken: string,
  ): Promise<CartView> {
    if (!memberOwner.customerId) {
      throw new BadRequestException({
        code: 'customer_auth_required',
        message: 'Only authenticated customers can merge carts',
      });
    }
    const guestOwner: CartOwner = {
      tenantId: memberOwner.tenantId,
      customerId: null,
      cartToken: guestCartToken,
    };
    const guestKeyStr = this.keyFor(guestOwner);
    const memberKeyStr = this.keyFor(memberOwner);
    const [guestRaw, memberRaw] = await this.redis.mget(guestKeyStr, memberKeyStr);
    if (!guestRaw) {
      // Nothing to merge — return the member cart as-is.
      const state = memberRaw
        ? (JSON.parse(memberRaw) as CartState)
        : this.empty(memberOwner, memberKeyStr);
      return this.withTotals(state);
    }
    const guest = JSON.parse(guestRaw) as CartState;
    const member = memberRaw
      ? (JSON.parse(memberRaw) as CartState)
      : this.empty(memberOwner, memberKeyStr);

    for (const gi of guest.items) {
      const existing = member.items.find((m) => m.variantId === gi.variantId);
      if (existing) {
        existing.quantity = Math.min(999, existing.quantity + gi.quantity);
      } else {
        member.items.push({ ...gi });
      }
    }
    // Merged cart adopts guest currency when member cart was empty.
    if (!member.currency) member.currency = guest.currency;
    member.customerId = memberOwner.customerId;
    await this.save(member, memberOwner);
    await this.redis.del(guestKeyStr);
    return this.withTotals(member);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async loadStateForWrite(owner: CartOwner): Promise<CartState | null> {
    const raw = await this.redis.get(this.keyFor(owner));
    return raw ? (JSON.parse(raw) as CartState) : null;
  }
}

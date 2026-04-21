import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import {
  type CheckoutAddressInput,
  type SetPaymentInput,
  type SetShippingInput,
  type StartCheckoutInput,
} from '@ecf/validation';
import { withTenant } from '@ecf/db';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { CartService, type CartOwner } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ShippingRegistryService } from '../../common/shipping/shipping-registry.service';
import type { CheckoutSession, CheckoutStep } from './checkout.types';

/** Checkout sessions last 15 min — same TTL as the inventory reservation. */
const CHECKOUT_TTL_SECONDS = 15 * 60;

/** Legacy method → (providerCode, rateCode) mapping for old storefronts. */
const LEGACY_SHIPPING_MAP: Record<string, { providerCode: string; rateCode: string }> = {
  standard: { providerCode: 'flat_rate', rateCode: 'standard' },
  express: { providerCode: 'flat_rate', rateCode: 'express' },
};

function sessionKey(tenantId: string, token: string): string {
  return `checkout:t:${tenantId}:${token}`;
}

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly ctx: TenantContextService,
    private readonly cart: CartService,
    private readonly inventory: InventoryService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly shippingRegistry: ShippingRegistryService,
  ) {}

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------

  async start(
    owner: CartOwner,
    input: StartCheckoutInput,
  ): Promise<CheckoutSession> {
    const cart = await this.cart.load(owner);
    if (cart.items.length === 0) {
      throw new BadRequestException({
        code: 'cart_empty',
        message: 'Cart is empty',
      });
    }
    if (!cart.currency) {
      throw new BadRequestException({
        code: 'cart_invalid',
        message: 'Cart has no currency — add at least one item',
      });
    }

    const token = randomUUID();
    const reservation = await this.inventory.reserve(
      cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      token,
      15,
    );

    const appliedCoupon = cart.coupons[0];
    let couponId: string | null = null;
    if (appliedCoupon) {
      const row = await withTenant({ tenantId: owner.tenantId }, (tx) =>
        tx.coupon.findUnique({
          where: { tenantId_code: { tenantId: owner.tenantId, code: appliedCoupon.code } },
          select: { id: true },
        }),
      );
      couponId = row?.id ?? null;
    }

    const session: CheckoutSession = {
      token,
      tenantId: owner.tenantId,
      customerId: owner.customerId,
      cartToken: owner.cartToken,
      cart: {
        items: cart.items,
        currency: cart.currency,
        subtotalMinor: cart.totals.subtotalMinor.toString(),
        discountMinor: cart.totals.discountMinor.toString(),
        couponCode: appliedCoupon?.code ?? null,
        couponId,
      },
      step: 'address',
      shippingAddress: null,
      billingAddress: null,
      shipping: null,
      payment: null,
      orderId: null,
      reservationIds: reservation.reservationIds,
      reservationExpiresAt: reservation.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!owner.customerId && input.guestEmail) {
      session.shippingAddress = {
        fullName: '',
        phone: null,
        email: input.guestEmail,
        line1: '',
        line2: null,
        city: '',
        region: null,
        postalCode: '',
        country: '',
      };
    }
    await this.save(session);
    return session;
  }

  // -------------------------------------------------------------------------
  // Step mutations
  // -------------------------------------------------------------------------

  async setAddress(
    token: string,
    kind: 'shipping' | 'billing',
    input: CheckoutAddressInput,
  ): Promise<CheckoutSession> {
    const session = await this.requireSession(token);
    this.requireStepAtLeast(session, ['address', 'shipping', 'payment']);
    const address = {
      fullName: input.fullName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      region: input.region ?? null,
      postalCode: input.postalCode,
      country: input.country,
    };
    if (kind === 'shipping') session.shippingAddress = address;
    else session.billingAddress = address;
    if (session.shippingAddress) session.step = this.advance(session.step, 'shipping');
    await this.save(session);
    return session;
  }

  /** List shipping rates available for the current session's address + cart. */
  async getShippingRates(token: string) {
    const session = await this.requireSession(token);
    if (!session.shippingAddress) {
      throw new BadRequestException({
        code: 'address_required',
        message: 'Set a shipping address first',
      });
    }
    const rates = await this.shippingRegistry.listAvailable({
      tenantId: session.tenantId,
      destinationAddress: session.shippingAddress,
      subtotalMinor: BigInt(session.cart.subtotalMinor),
      currency: session.cart.currency,
      packages: [],
    });
    return rates.map((r) => ({
      providerCode: r.providerCode,
      code: r.code,
      name: r.name,
      priceMinor: r.priceMinor.toString(),
      currency: r.currency,
      estimatedDays: r.estimatedDays ?? null,
      description: r.description ?? null,
      freeShippingApplied: r.freeShippingApplied ?? false,
    }));
  }

  async setShipping(
    token: string,
    input: SetShippingInput,
  ): Promise<CheckoutSession> {
    const session = await this.requireSession(token);
    if (!session.shippingAddress) {
      throw new BadRequestException({
        code: 'address_required',
        message: 'Set a shipping address before choosing a shipping method',
      });
    }

    // Resolve (providerCode, rateCode) from legacy `method` or explicit input.
    let providerCode = input.providerCode;
    let rateCode = input.rateCode;
    if (!providerCode || !rateCode) {
      const legacy = input.method ? LEGACY_SHIPPING_MAP[input.method] : null;
      if (legacy) {
        providerCode = legacy.providerCode;
        rateCode = legacy.rateCode;
      }
    }
    if (!providerCode || !rateCode) {
      throw new BadRequestException({
        code: 'shipping_invalid',
        message: 'Provide either method (legacy) or providerCode+rateCode',
      });
    }

    // Apply free-shipping coupon override (FREE_SHIPPING coupons zero the price).
    const hasFreeShippingCoupon = session.cart.couponCode
      ? await this.isFreeShippingCoupon(session.tenantId, session.cart.couponCode)
      : false;

    const rate = await this.shippingRegistry.requireRate(
      session.tenantId,
      providerCode,
      rateCode,
      {
        destinationAddress: session.shippingAddress,
        subtotalMinor: BigInt(session.cart.subtotalMinor),
        currency: session.cart.currency,
      },
    );
    const priceMinor = hasFreeShippingCoupon ? 0n : rate.priceMinor;

    session.shipping = {
      providerCode: rate.providerCode,
      rateCode: rate.code,
      name: rate.name,
      priceMinor: priceMinor.toString(),
    };
    session.step = this.advance(session.step, 'payment');
    await this.save(session);
    return session;
  }

  async setPayment(
    token: string,
    input: SetPaymentInput,
  ): Promise<CheckoutSession> {
    const session = await this.requireSession(token);
    if (!session.shipping) {
      throw new BadRequestException({
        code: 'shipping_required',
        message: 'Select a shipping method before payment',
      });
    }
    const providerCode = input.providerCode ?? input.method;
    if (!providerCode) {
      throw new BadRequestException({
        code: 'payment_invalid',
        message: 'Provide either method (legacy) or providerCode',
      });
    }
    session.payment = {
      providerCode,
      providerRef: null,
      token: input.stubToken ?? null,
      returnUrl: input.returnUrl ?? null,
      status: 'pending',
      redirectUrl: null,
    };
    session.step = this.advance(session.step, 'ready');
    await this.save(session);
    return session;
  }

  // -------------------------------------------------------------------------
  // Complete — creates Order, initializes Payment via provider, confirms inventory.
  // -------------------------------------------------------------------------

  async complete(token: string): Promise<{
    orderId: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    redirectUrl?: string;
  }> {
    const session = await this.requireSession(token);
    if (!session.shipping || !session.shippingAddress || !session.payment) {
      throw new BadRequestException({
        code: 'checkout_incomplete',
        message: 'Checkout is missing address, shipping, or payment',
      });
    }
    if (session.orderId) {
      throw new BadRequestException({
        code: 'checkout_already_completed',
        message: 'This checkout has already been completed',
      });
    }

    const cart = session.cart;
    const subtotal = BigInt(cart.subtotalMinor);
    const discount = BigInt(cart.discountMinor);
    const shippingMinor = BigInt(session.shipping.priceMinor);
    const total = subtotal - discount + shippingMinor;

    // Create the order in pending_payment state; the provider result below
    // transitions it to payment_success or payment_failed.
    const order = await this.orders.create(
      {
        customerId: session.customerId,
        guestEmail: session.shippingAddress.email,
        currency: cart.currency,
        subtotalMinor: subtotal,
        shippingMinor,
        discountMinor: discount,
        taxMinor: 0n,
        totalMinor: total,
        paymentProvider: session.payment.providerCode,
        paymentRef: null,
        couponCode: cart.couponCode,
        couponId: cart.couponId,
        lines: cart.items.map((i) => ({
          variantId: i.variantId,
          productId: i.productId,
          sku: i.sku,
          titleSnapshot: i.title,
          priceMinorUnits: BigInt(i.priceMinor),
          quantity: i.quantity,
        })),
      },
      'pending_payment',
    );

    // Fire the provider — create Payment row + drive init().
    let initResult;
    try {
      const res = await this.payments.initForOrder({
        tenantId: session.tenantId,
        orderId: order.id,
        providerCode: session.payment.providerCode,
        amount: total,
        currency: cart.currency,
        customer: {
          id: session.customerId,
          email: session.shippingAddress.email,
          fullName: session.shippingAddress.fullName,
        },
        returnUrl: session.payment.returnUrl,
      });
      initResult = res.initResult;
      session.payment.providerRef = res.payment.providerRef;
    } catch (err) {
      // Leave order in pending_payment; a retry can re-drive payment.
      throw err;
    }

    // Transition order based on the provider result.
    let finalStatus: string = order.status;
    if (initResult.status === 'captured') {
      await this.orders.updateStatus(order.id, {
        to: 'payment_success',
        note: `Payment captured via ${session.payment.providerCode}`,
      });
      finalStatus = 'payment_success';
    } else if (initResult.status === 'failed') {
      await this.orders.updateStatus(order.id, {
        to: 'payment_failed',
        note: initResult.failureReason ?? 'Payment initialization failed',
      });
      finalStatus = 'payment_failed';
    } else {
      // pending / requires_redirect — order stays in pending_payment.
    }

    session.payment.status = initResult.status;
    session.payment.redirectUrl = initResult.redirectUrl ?? null;

    // Inventory confirm/release AFTER order is created.
    await this.inventory.confirm(token, order.id);

    // Clear cart + mark session completed (kept 1h for audit).
    const owner: CartOwner = {
      tenantId: session.tenantId,
      customerId: session.customerId,
      cartToken: session.cartToken,
    };
    await this.cart.clear(owner);

    session.orderId = order.id;
    session.step = 'completed';
    await this.redis.set(
      sessionKey(session.tenantId, session.token),
      JSON.stringify(session),
      'EX',
      60 * 60,
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: finalStatus,
      paymentStatus: initResult.status,
      redirectUrl: initResult.redirectUrl,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  async get(token: string): Promise<CheckoutSession> {
    return this.requireSession(token);
  }

  private async isFreeShippingCoupon(
    tenantId: string,
    code: string,
  ): Promise<boolean> {
    const row = await withTenant({ tenantId }, (tx) =>
      tx.coupon.findUnique({
        where: { tenantId_code: { tenantId, code } },
        select: { type: true },
      }),
    );
    return row?.type === 'FREE_SHIPPING';
  }

  private async requireSession(token: string): Promise<CheckoutSession> {
    const tenantId = this.ctx.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    const raw = await this.redis.get(sessionKey(tenantId, token));
    if (!raw) {
      throw new NotFoundException({
        code: 'checkout_not_found',
        message: 'Checkout session expired or not found',
      });
    }
    return JSON.parse(raw) as CheckoutSession;
  }

  private async save(session: CheckoutSession): Promise<void> {
    session.updatedAt = new Date().toISOString();
    await this.redis.set(
      sessionKey(session.tenantId, session.token),
      JSON.stringify(session),
      'EX',
      CHECKOUT_TTL_SECONDS,
    );
  }

  private requireStepAtLeast(session: CheckoutSession, allowed: CheckoutStep[]): void {
    if (!allowed.includes(session.step)) {
      throw new BadRequestException({
        code: 'checkout_step_invalid',
        message: `Cannot run this step while checkout is at ${session.step}`,
      });
    }
  }

  private advance(current: CheckoutStep, target: CheckoutStep): CheckoutStep {
    const order: CheckoutStep[] = ['address', 'shipping', 'payment', 'ready', 'completed'];
    return order.indexOf(target) > order.indexOf(current) ? target : current;
  }
}

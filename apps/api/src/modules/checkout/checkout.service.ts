import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import {
  SHIPPING_CATALOGUE,
  type CheckoutAddressInput,
  type PaymentMethod,
  type SetPaymentInput,
  type SetShippingInput,
  type StartCheckoutInput,
} from '@ecf/validation';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { CartService, type CartOwner } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import type { CheckoutSession, CheckoutStep } from './checkout.types';

/** Checkout sessions last 15 min — same TTL as the inventory reservation. */
const CHECKOUT_TTL_SECONDS = 15 * 60;

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
  ) {}

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------

  /**
   * Lock the current cart into a checkout session + reserve inventory for 15m.
   * If the cart is empty / out of stock this throws — the storefront handles
   * both cases at the drawer level.
   */
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
    const option = SHIPPING_CATALOGUE[input.method];
    session.shipping = {
      method: input.method,
      priceMinor: option.priceMinor.toString(),
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
    session.payment = {
      method: input.method as PaymentMethod,
      stubToken: input.stubToken ?? null,
      providerRef: `stub_${randomUUID()}`,
      status: 'pending_stub',
    };
    session.step = this.advance(session.step, 'ready');
    await this.save(session);
    return session;
  }

  // -------------------------------------------------------------------------
  // Complete — creates Order, confirms inventory, clears cart.
  // -------------------------------------------------------------------------

  async complete(token: string): Promise<{ orderId: string; orderNumber: string; status: string }> {
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

    // Payment semantics:
    //   stub_card → auto-succeeds, order.status = payment_success
    //   cod       → pending_payment, admin flips to paid when cash collected
    const initialStatus = session.payment.method === 'stub_card' ? 'payment_success' : 'pending_payment';
    if (session.payment.method === 'stub_card') session.payment.status = 'paid_stub';

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
        paymentProvider: session.payment.method === 'cod' ? 'cod' : 'stub',
        paymentRef: session.payment.providerRef,
        lines: cart.items.map((i) => ({
          variantId: i.variantId,
          productId: i.productId,
          sku: i.sku,
          titleSnapshot: i.title,
          priceMinorUnits: BigInt(i.priceMinor),
          quantity: i.quantity,
        })),
      },
      initialStatus,
    );

    // Inventory confirm/release MUST happen after the order is created — if
    // confirm fails mid-way we surface a 500 and the inventory job will sweep
    // the reservation on TTL expiry. We never leave reservations dangling.
    await this.inventory.confirm(token, order.id);

    // Clear cart and mark checkout session completed (kept for 1h for audit).
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

    return { orderId: order.id, orderNumber: order.orderNumber, status: order.status };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  async get(token: string): Promise<CheckoutSession> {
    return this.requireSession(token);
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

  /** Move the step forward only — never regress. */
  private advance(current: CheckoutStep, target: CheckoutStep): CheckoutStep {
    const order: CheckoutStep[] = ['address', 'shipping', 'payment', 'ready', 'completed'];
    return order.indexOf(target) > order.indexOf(current) ? target : current;
  }
}

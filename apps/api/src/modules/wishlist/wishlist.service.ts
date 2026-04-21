import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { withTenant } from '@ecf/db';
import type { AddToWishlistInput } from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { CartService } from '../cart/cart.service';

/**
 * Customer wishlist — FSD 4.6. Single entry per (customer, product); variant
 * is optional so a customer can save a product before picking a variant.
 * Guest wishlists aren't persisted (YAGNI: the frontend can keep them in
 * localStorage until the customer logs in).
 */
@Injectable()
export class WishlistService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly cart: CartService,
  ) {}

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

  async list() {
    const { tenantId, customerId } = this.requireCustomer();
    return withTenant({ tenantId }, async (tx) => {
      const items = await tx.wishlistItem.findMany({
        where: { tenantId, customerId },
        orderBy: { createdAt: 'desc' },
      });
      if (items.length === 0) return [];

      const productIds = Array.from(new Set(items.map((i) => i.productId)));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          brand: { select: { id: true, name: true } },
          variants: {
            select: {
              id: true,
              sku: true,
              priceMinorUnits: true,
              compareAtMinorUnits: true,
              currency: true,
              stockOnHand: true,
              stockReserved: true,
            },
            orderBy: { priceMinorUnits: 'asc' },
            take: 1,
          },
          media: {
            select: { id: true, url: true, key: true },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      const pmap = new Map(products.map((p) => [p.id, p]));

      return items.map((i) => {
        const p = pmap.get(i.productId);
        const v = p?.variants[0];
        return {
          productId: i.productId,
          variantId: i.variantId,
          addedAt: i.createdAt,
          product: p
            ? {
                id: p.id,
                slug: p.slug,
                title: p.title,
                status: p.status,
                brand: p.brand,
                priceMinor: v ? v.priceMinorUnits.toString() : null,
                compareAtMinor:
                  v?.compareAtMinorUnits != null
                    ? v.compareAtMinorUnits.toString()
                    : null,
                currency: v?.currency ?? null,
                inStock: v ? v.stockOnHand - v.stockReserved > 0 : false,
                defaultVariantId: v?.id ?? null,
                image: p.media[0]
                  ? { id: p.media[0].id, url: p.media[0].url, key: p.media[0].key }
                  : null,
              }
            : null,
        };
      });
    });
  }

  async add(input: AddToWishlistInput) {
    const { tenantId, customerId } = this.requireCustomer();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true, tenantId: true },
      });
      if (!product || product.tenantId !== tenantId) {
        throw new NotFoundException({ code: 'product_not_found', message: 'Product not found' });
      }

      const existing = await tx.wishlistItem.findUnique({
        where: {
          tenantId_customerId_productId: { tenantId, customerId, productId: input.productId },
        },
      });
      if (existing) {
        // Idempotent: update variantId if caller provided a new one.
        if (input.variantId && input.variantId !== existing.variantId) {
          return tx.wishlistItem.update({
            where: {
              tenantId_customerId_productId: {
                tenantId,
                customerId,
                productId: input.productId,
              },
            },
            data: { variantId: input.variantId },
          });
        }
        return existing;
      }

      return tx.wishlistItem.create({
        data: {
          tenantId,
          customerId,
          productId: input.productId,
          variantId: input.variantId ?? null,
        },
      });
    });
  }

  async remove(productId: string) {
    const { tenantId, customerId } = this.requireCustomer();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      await tx.wishlistItem
        .delete({
          where: {
            tenantId_customerId_productId: { tenantId, customerId, productId },
          },
        })
        .catch(() => null);
      return { productId, deleted: true as const };
    });
  }

  /**
   * Move all items (that have a default variant with stock) to the member cart.
   * Items with no available variant are left on the wishlist.
   */
  async moveToCart() {
    const { tenantId, customerId } = this.requireCustomer();
    const entries = await this.list();
    const owner = this.cart.resolveOwner(null);
    let moved = 0;
    const skipped: Array<{ productId: string; reason: string }> = [];
    for (const e of entries) {
      if (!e.product?.defaultVariantId) {
        skipped.push({ productId: e.productId, reason: 'no_variant' });
        continue;
      }
      if (!e.product.inStock) {
        skipped.push({ productId: e.productId, reason: 'out_of_stock' });
        continue;
      }
      try {
        await this.cart.addItem(owner, e.variantId ?? e.product.defaultVariantId, 1);
        // Success — remove from wishlist.
        await this.remove(e.productId);
        moved += 1;
      } catch (err) {
        skipped.push({
          productId: e.productId,
          reason: err instanceof BadRequestException ? 'cart_rejected' : 'error',
        });
      }
    }
    return { moved, skipped };
  }
}

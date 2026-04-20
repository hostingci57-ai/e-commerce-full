import {
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import type { Prisma } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  BatchVariantsInput,
  CreateProductInput,
  ListProductsQuery,
  TranslationsBatchInput,
  UpdateProductInput,
} from '@ecf/validation';
import { ProductsRepository } from './products.repository';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { OutboxService } from '../../../common/outbox/outbox.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository,
    private readonly ctx: TenantContextService,
    private readonly outbox: OutboxService,
  ) {}

  private requireTenant(): string {
    const tenantId = this.ctx.tenantId;
    if (!tenantId) {
      throw new NotFoundException({ code: 'tenant_required', message: 'Tenant context required' });
    }
    return tenantId;
  }

  async create(input: CreateProductInput) {
    const tenantId = this.requireTenant();

    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const dupe = await tx.product.findUnique({
        where: { tenantId_slug: { tenantId, slug: input.slug } },
        select: { id: true },
      });
      if (dupe) {
        throw new ConflictException({
          code: 'product_slug_taken',
          message: `Slug "${input.slug}" is already in use`,
        });
      }

      const product = await tx.product.create({
        data: {
          tenantId,
          slug: input.slug,
          title: input.title,
          description: input.description ?? null,
          brandId: input.brandId ?? null,
          status: input.status ?? 'draft',
          categories: {
            create: input.categoryIds.map((categoryId, idx) => ({
              tenantId,
              categoryId,
              position: idx,
            })),
          },
          variants: input.variant
            ? {
                create: [
                  {
                    tenantId,
                    sku: input.variant.sku,
                    priceMinorUnits: input.variant.priceMinorUnits,
                    compareAtMinorUnits: input.variant.compareAtMinorUnits ?? null,
                    currency: input.variant.currency,
                    stockOnHand: input.variant.stockOnHand ?? 0,
                    weightGrams: input.variant.weightGrams ?? null,
                  },
                ],
              }
            : undefined,
        },
        include: { brand: true, variants: true, categories: true },
      });

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Product',
        aggregateId: product.id,
        eventType: 'product.created',
        payload: {
          id: product.id,
          slug: product.slug,
          title: product.title,
          status: product.status,
        } as Prisma.InputJsonValue,
      });

      return product;
    });
  }

  async list(query: ListProductsQuery) {
    const tenantId = this.requireTenant();
    return this.repo.list(tenantId, query);
  }

  async findById(id: string) {
    const tenantId = this.requireTenant();
    const p = await this.repo.findById(tenantId, id);
    if (!p) throw new NotFoundException({ code: 'product_not_found', message: 'Product not found' });
    return p;
  }

  async update(id: string, input: UpdateProductInput) {
    const tenantId = this.requireTenant();

    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({ code: 'product_not_found', message: 'Product not found' });
      }

      if (input.slug && input.slug !== existing.slug) {
        const dupe = await tx.product.findUnique({
          where: { tenantId_slug: { tenantId, slug: input.slug } },
          select: { id: true },
        });
        if (dupe && dupe.id !== id) {
          throw new ConflictException({
            code: 'product_slug_taken',
            message: `Slug "${input.slug}" is already in use`,
          });
        }
      }

      const data: Prisma.ProductUpdateInput = {};
      if (input.slug !== undefined) data.slug = input.slug;
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined) data.description = input.description ?? null;
      if (input.status !== undefined) data.status = input.status;
      if (input.brandId !== undefined) {
        data.brand = input.brandId ? { connect: { id: input.brandId } } : { disconnect: true };
      }

      const updated = await tx.product.update({ where: { id }, data });

      if (input.categoryIds) {
        // Replace membership set atomically.
        await tx.categoryProduct.deleteMany({ where: { productId: id } });
        if (input.categoryIds.length > 0) {
          await tx.categoryProduct.createMany({
            data: input.categoryIds.map((categoryId, idx) => ({
              tenantId,
              categoryId,
              productId: id,
              position: idx,
            })),
          });
        }
      }

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Product',
        aggregateId: id,
        eventType: 'product.updated',
        payload: { id, changes: input } as Prisma.InputJsonValue,
      });

      return updated;
    });
  }

  /**
   * Soft delete — sets status to `archived`. A true "deleted" state is not
   * part of the ProductStatus enum; we use `archived` as the tombstone so
   * existing order history referencing the product remains readable.
   */
  async remove(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({ code: 'product_not_found', message: 'Product not found' });
      }
      await tx.product.update({ where: { id }, data: { status: 'archived' } });
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Product',
        aggregateId: id,
        eventType: 'product.deleted',
        payload: { id } as Prisma.InputJsonValue,
      });
      return { id, status: 'archived' as const };
    });
  }

  async upsertVariants(productId: string, input: BatchVariantsInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const parent = await tx.product.findUnique({ where: { id: productId } });
      if (!parent) {
        throw new NotFoundException({ code: 'product_not_found', message: 'Product not found' });
      }
      const results: Array<{ id: string; sku: string }> = [];
      for (const v of input.variants) {
        if (v.id) {
          const updated = await tx.productVariant.update({
            where: { id: v.id },
            data: {
              sku: v.sku,
              priceMinorUnits: v.priceMinorUnits,
              compareAtMinorUnits: v.compareAtMinorUnits ?? null,
              currency: v.currency,
              stockOnHand: v.stockOnHand,
              weightGrams: v.weightGrams ?? null,
              optionValue1Id: v.optionValue1Id ?? null,
              optionValue2Id: v.optionValue2Id ?? null,
              optionValue3Id: v.optionValue3Id ?? null,
            },
            select: { id: true, sku: true },
          });
          results.push(updated);
        } else {
          const created = await tx.productVariant.create({
            data: {
              tenantId,
              productId,
              sku: v.sku,
              priceMinorUnits: v.priceMinorUnits,
              compareAtMinorUnits: v.compareAtMinorUnits ?? null,
              currency: v.currency,
              stockOnHand: v.stockOnHand,
              weightGrams: v.weightGrams ?? null,
              optionValue1Id: v.optionValue1Id ?? null,
              optionValue2Id: v.optionValue2Id ?? null,
              optionValue3Id: v.optionValue3Id ?? null,
            },
            select: { id: true, sku: true },
          });
          results.push(created);
        }
      }
      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Product',
        aggregateId: productId,
        eventType: 'product.variants.updated',
        payload: { productId, variantIds: results.map((r) => r.id) } as Prisma.InputJsonValue,
      });
      return { productId, variants: results };
    });
  }

  /**
   * ProductTranslation model is not yet in the Prisma schema (arch-context
   * marks it as a stub to be added with a later migration). Until then we
   * acknowledge the request shape and respond 501 so storefront clients can
   * feature-detect. Known-issues logged in catalog-customers-output.json.
   */
  upsertTranslations(_productId: string, _input: TranslationsBatchInput) {
    throw new NotImplementedException({
      code: 'translations_not_implemented',
      message: 'ProductTranslation model is scheduled for a later migration (schema stub).',
    });
  }
}

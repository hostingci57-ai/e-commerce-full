import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { withTenant } from '@ecf/db';
import type { CreateBrandInput, UpdateBrandInput } from '@ecf/validation';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class BrandsService {
  constructor(private readonly ctx: TenantContextService) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) throw new NotFoundException({ code: 'tenant_required', message: 'Tenant context required' });
    return id;
  }

  async create(input: CreateBrandInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const dupe = await tx.brand.findUnique({
        where: { tenantId_slug: { tenantId, slug: input.slug } },
        select: { id: true },
      });
      if (dupe) {
        throw new ConflictException({
          code: 'brand_slug_taken',
          message: `Slug "${input.slug}" is already in use`,
        });
      }
      return tx.brand.create({
        data: { tenantId, slug: input.slug, name: input.name },
      });
    });
  }

  async list() {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, (tx) => tx.brand.findMany({ orderBy: { name: 'asc' } }));
  }

  async findById(id: string) {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId }, (tx) => tx.brand.findUnique({ where: { id } }));
    if (!row) throw new NotFoundException({ code: 'brand_not_found', message: 'Brand not found' });
    return row;
  }

  async update(id: string, input: UpdateBrandInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.brand.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException({ code: 'brand_not_found', message: 'Brand not found' });
      if (input.slug && input.slug !== existing.slug) {
        const dupe = await tx.brand.findUnique({
          where: { tenantId_slug: { tenantId, slug: input.slug } },
        });
        if (dupe && dupe.id !== id) {
          throw new ConflictException({
            code: 'brand_slug_taken',
            message: `Slug "${input.slug}" is already in use`,
          });
        }
      }
      return tx.brand.update({
        where: { id },
        data: { slug: input.slug ?? undefined, name: input.name ?? undefined },
      });
    });
  }

  async remove(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const used = await tx.product.count({ where: { brandId: id } });
      if (used > 0) {
        throw new ConflictException({
          code: 'brand_in_use',
          message: 'Brand is assigned to one or more products',
        });
      }
      await tx.brand.delete({ where: { id } });
      return { id, deleted: true };
    });
  }
}

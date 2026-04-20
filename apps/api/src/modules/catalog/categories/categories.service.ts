import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { withTenant } from '@ecf/db';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@ecf/validation';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

type TreeNode = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  position: number;
  children: TreeNode[];
};

@Injectable()
export class CategoriesService {
  constructor(private readonly ctx: TenantContextService) {}

  private requireTenant(): string {
    const tenantId = this.ctx.tenantId;
    if (!tenantId) {
      throw new NotFoundException({ code: 'tenant_required', message: 'Tenant context required' });
    }
    return tenantId;
  }

  async create(input: CreateCategoryInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const dupe = await tx.category.findUnique({
        where: { tenantId_slug: { tenantId, slug: input.slug } },
        select: { id: true },
      });
      if (dupe) {
        throw new ConflictException({
          code: 'category_slug_taken',
          message: `Slug "${input.slug}" is already in use`,
        });
      }
      if (input.parentId) {
        const parent = await tx.category.findUnique({ where: { id: input.parentId } });
        if (!parent) {
          throw new BadRequestException({
            code: 'category_parent_not_found',
            message: 'parentId does not exist',
          });
        }
      }
      return tx.category.create({
        data: {
          tenantId,
          slug: input.slug,
          name: input.name,
          parentId: input.parentId ?? null,
          position: input.position ?? 0,
        },
      });
    });
  }

  async list() {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, (tx) =>
      tx.category.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    );
  }

  async tree(): Promise<TreeNode[]> {
    const tenantId = this.requireTenant();
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.category.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    );
    const byId = new Map<string, TreeNode>();
    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        slug: r.slug,
        name: r.name,
        parentId: r.parentId,
        position: r.position,
        children: [],
      });
    }
    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findById(id: string) {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId }, (tx) => tx.category.findUnique({ where: { id } }));
    if (!row) throw new NotFoundException({ code: 'category_not_found', message: 'Category not found' });
    return row;
  }

  async update(id: string, input: UpdateCategoryInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({ code: 'category_not_found', message: 'Category not found' });
      }
      if (input.slug && input.slug !== existing.slug) {
        const dupe = await tx.category.findUnique({
          where: { tenantId_slug: { tenantId, slug: input.slug } },
        });
        if (dupe && dupe.id !== id) {
          throw new ConflictException({
            code: 'category_slug_taken',
            message: `Slug "${input.slug}" is already in use`,
          });
        }
      }
      if (input.parentId !== undefined && input.parentId && input.parentId === id) {
        throw new BadRequestException({
          code: 'category_self_parent',
          message: 'Category cannot be its own parent',
        });
      }
      return tx.category.update({
        where: { id },
        data: {
          slug: input.slug ?? undefined,
          name: input.name ?? undefined,
          position: input.position ?? undefined,
          parentId: input.parentId === undefined ? undefined : (input.parentId ?? null),
        },
      });
    });
  }

  async remove(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const children = await tx.category.count({ where: { parentId: id } });
      if (children > 0) {
        throw new ConflictException({
          code: 'category_has_children',
          message: 'Re-parent or delete children first',
        });
      }
      const used = await tx.categoryProduct.count({ where: { categoryId: id } });
      if (used > 0) {
        throw new ConflictException({
          code: 'category_in_use',
          message: 'Category still assigned to products',
        });
      }
      await tx.category.delete({ where: { id } });
      return { id, deleted: true };
    });
  }
}

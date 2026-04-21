import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { withTenant } from '@ecf/db';
import type { Prisma } from '@ecf/db';
import type {
  CreateCmsPageInput,
  ListCmsPagesQuery,
  UpdateCmsMenuInput,
  UpdateCmsPageInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class CmsService {
  constructor(private readonly ctx: TenantContextService) {}

  private requireTenant(): string {
    const tenantId = this.ctx.tenantId;
    if (!tenantId) {
      throw new NotFoundException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  /* ---------------- Pages ---------------- */

  async createPage(input: CreateCmsPageInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const dupe = await tx.cmsPage.findUnique({
        where: { tenantId_slug: { tenantId, slug: input.slug } },
        select: { id: true },
      });
      if (dupe) {
        throw new ConflictException({
          code: 'cms_page_slug_taken',
          message: `Slug "${input.slug}" is already in use`,
        });
      }
      return tx.cmsPage.create({
        data: {
          tenantId,
          slug: input.slug,
          title: input.title,
          content: input.content,
          metaTitle: input.metaTitle ?? null,
          metaDescription: input.metaDescription ?? null,
          isPublished: input.isPublished,
          publishedAt: input.isPublished ? new Date() : null,
          showInFooter: input.showInFooter,
          showInHeader: input.showInHeader,
          sortOrder: input.sortOrder,
        },
      });
    });
  }

  async listPages(query: ListCmsPagesQuery) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const where: Prisma.CmsPageWhereInput = { tenantId };
      if (query.isPublished !== undefined) where.isPublished = query.isPublished;
      if (query.location === 'footer') where.showInFooter = true;
      if (query.location === 'header') where.showInHeader = true;
      return tx.cmsPage.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        take: query.limit,
      });
    });
  }

  async getPageById(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const page = await tx.cmsPage.findFirst({ where: { id, tenantId } });
      if (!page) {
        throw new NotFoundException({
          code: 'cms_page_not_found',
          message: 'Page not found',
        });
      }
      return page;
    });
  }

  async updatePage(id: string, input: UpdateCmsPageInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.cmsPage.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException({
          code: 'cms_page_not_found',
          message: 'Page not found',
        });
      }
      if (input.slug && input.slug !== existing.slug) {
        const dupe = await tx.cmsPage.findUnique({
          where: { tenantId_slug: { tenantId, slug: input.slug } },
          select: { id: true },
        });
        if (dupe && dupe.id !== id) {
          throw new ConflictException({
            code: 'cms_page_slug_taken',
            message: `Slug "${input.slug}" is already in use`,
          });
        }
      }
      const data: Prisma.CmsPageUpdateInput = {};
      if (input.slug !== undefined) data.slug = input.slug;
      if (input.title !== undefined) data.title = input.title;
      if (input.content !== undefined) data.content = input.content;
      if (input.metaTitle !== undefined) data.metaTitle = input.metaTitle ?? null;
      if (input.metaDescription !== undefined)
        data.metaDescription = input.metaDescription ?? null;
      if (input.showInFooter !== undefined) data.showInFooter = input.showInFooter;
      if (input.showInHeader !== undefined) data.showInHeader = input.showInHeader;
      if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
      if (input.isPublished !== undefined) {
        data.isPublished = input.isPublished;
        if (input.isPublished && !existing.publishedAt) {
          data.publishedAt = new Date();
        } else if (!input.isPublished) {
          data.publishedAt = null;
        }
      }
      return tx.cmsPage.update({ where: { id }, data });
    });
  }

  async deletePage(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.cmsPage.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException({
          code: 'cms_page_not_found',
          message: 'Page not found',
        });
      }
      await tx.cmsPage.delete({ where: { id } });
      return { id, deleted: true as const };
    });
  }

  async setPublished(id: string, published: boolean) {
    return this.updatePage(id, { isPublished: published });
  }

  async getPublicPageBySlug(tenantId: string, slug: string) {
    return withTenant({ tenantId }, async (tx) => {
      const page = await tx.cmsPage.findFirst({
        where: { tenantId, slug, isPublished: true },
      });
      if (!page) {
        throw new NotFoundException({
          code: 'cms_page_not_found',
          message: 'Page not found',
        });
      }
      return page;
    });
  }

  async listPublicPages(tenantId: string, location?: 'header' | 'footer') {
    return withTenant({ tenantId }, async (tx) => {
      const where: Prisma.CmsPageWhereInput = { tenantId, isPublished: true };
      if (location === 'footer') where.showInFooter = true;
      if (location === 'header') where.showInHeader = true;
      return tx.cmsPage.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          showInFooter: true,
          showInHeader: true,
          sortOrder: true,
          publishedAt: true,
          updatedAt: true,
        },
      });
    });
  }

  /* ---------------- Menus ---------------- */

  async listMenus() {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      return tx.cmsMenu.findMany({
        where: { tenantId },
        orderBy: { key: 'asc' },
      });
    });
  }

  async getMenuByKey(key: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const menu = await tx.cmsMenu.findUnique({
        where: { tenantId_key: { tenantId, key } },
      });
      if (!menu) {
        throw new NotFoundException({
          code: 'cms_menu_not_found',
          message: 'Menu not found',
        });
      }
      return menu;
    });
  }

  async updateMenu(key: string, input: UpdateCmsMenuInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      // Upsert — creates if a tenant has not yet seeded that key.
      return tx.cmsMenu.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: {
          name: input.name ?? undefined,
          items: input.items as Prisma.InputJsonValue,
          isActive: input.isActive ?? undefined,
        },
        create: {
          tenantId,
          key,
          name: input.name ?? key,
          items: input.items as Prisma.InputJsonValue,
          isActive: input.isActive ?? true,
        },
      });
    });
  }

  async getPublicMenu(tenantId: string, key: string) {
    return withTenant({ tenantId }, async (tx) => {
      const menu = await tx.cmsMenu.findUnique({
        where: { tenantId_key: { tenantId, key } },
      });
      if (!menu || !menu.isActive) {
        // public menus never 404 the page — return an empty payload
        return { key, name: key, items: [] as unknown[], isActive: false };
      }
      return {
        key: menu.key,
        name: menu.name,
        items: menu.items,
        isActive: menu.isActive,
      };
    });
  }
}

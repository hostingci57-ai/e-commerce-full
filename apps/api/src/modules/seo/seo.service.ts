import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { withTenant } from '@ecf/db';
import type { Prisma } from '@ecf/db';
import type {
  CreateRedirectInput,
  ListRedirectsQuery,
  UpdateRedirectInput,
  UpdateSeoSettingInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

const REDIRECT_CACHE_TTL_SEC = 300;

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  constructor(
    private readonly ctx: TenantContextService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private requireTenant(): string {
    const tid = this.ctx.tenantId;
    if (!tid) {
      throw new NotFoundException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return tid;
  }

  /* ---------------- Redirects (admin) ---------------- */

  async createRedirect(input: CreateRedirectInput) {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      return tx.redirect.upsert({
        where: { tenantId_fromPath: { tenantId, fromPath: input.fromPath } },
        update: {
          toPath: input.toPath,
          statusCode: input.statusCode,
          isActive: input.isActive,
        },
        create: {
          tenantId,
          fromPath: input.fromPath,
          toPath: input.toPath,
          statusCode: input.statusCode,
          isActive: input.isActive,
        },
      });
    });
    await this.invalidateRedirectCache(tenantId, input.fromPath);
    return row;
  }

  async listRedirects(query: ListRedirectsQuery) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const where: Prisma.RedirectWhereInput = { tenantId };
      if (query.isActive !== undefined) where.isActive = query.isActive;
      if (query.query) {
        where.OR = [
          { fromPath: { contains: query.query, mode: 'insensitive' } },
          { toPath: { contains: query.query, mode: 'insensitive' } },
        ];
      }
      return tx.redirect.findMany({
        where,
        orderBy: { fromPath: 'asc' },
        take: query.limit,
      });
    });
  }

  async updateRedirect(id: string, input: UpdateRedirectInput) {
    const tenantId = this.requireTenant();
    const row = await withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.redirect.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException({
          code: 'redirect_not_found',
          message: 'Redirect not found',
        });
      }
      const data: Prisma.RedirectUpdateInput = {};
      if (input.fromPath !== undefined) data.fromPath = input.fromPath;
      if (input.toPath !== undefined) data.toPath = input.toPath;
      if (input.statusCode !== undefined) data.statusCode = input.statusCode;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      const updated = await tx.redirect.update({ where: { id }, data });
      // Invalidate both old + new from path
      await this.invalidateRedirectCache(tenantId, existing.fromPath);
      if (input.fromPath && input.fromPath !== existing.fromPath) {
        await this.invalidateRedirectCache(tenantId, input.fromPath);
      }
      return updated;
    });
    return row;
  }

  async deleteRedirect(id: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.redirect.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException({
          code: 'redirect_not_found',
          message: 'Redirect not found',
        });
      }
      await tx.redirect.delete({ where: { id } });
      await this.invalidateRedirectCache(tenantId, existing.fromPath);
      return { id, deleted: true as const };
    });
  }

  async importRedirects(
    csv: string,
    overwrite: boolean,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const tenantId = this.requireTenant();
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // Accept an optional header row: from,to,status
    let idxFrom = 0;
    let idxTo = 1;
    let idxStatus = 2;
    const firstLine = lines[0] ?? '';
    const firstCols = firstLine.split(',').map((v) => v.trim().toLowerCase());
    if (firstCols.includes('from') && firstCols.includes('to')) {
      idxFrom = firstCols.indexOf('from');
      idxTo = firstCols.indexOf('to');
      idxStatus = firstCols.indexOf('status');
      lines.shift();
    }

    await withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      for (const raw of lines) {
        const cols = raw.split(',').map((v) => v.trim());
        const fromPath = cols[idxFrom];
        const toPath = cols[idxTo];
        const statusRaw = idxStatus >= 0 ? cols[idxStatus] : '301';
        const statusCode = Number.parseInt(statusRaw || '301', 10);
        if (!fromPath || !fromPath.startsWith('/')) {
          errors.push(`invalid from path: ${raw}`);
          continue;
        }
        if (!toPath) {
          errors.push(`missing to path: ${raw}`);
          continue;
        }
        if (![301, 302, 307, 308].includes(statusCode)) {
          errors.push(`invalid status code: ${raw}`);
          continue;
        }
        const existing = await tx.redirect.findUnique({
          where: { tenantId_fromPath: { tenantId, fromPath } },
        });
        if (existing && !overwrite) {
          continue; // skip without error
        }
        if (existing) {
          await tx.redirect.update({
            where: { id: existing.id },
            data: { toPath, statusCode, isActive: true },
          });
          updated += 1;
        } else {
          await tx.redirect.create({
            data: {
              tenantId,
              fromPath,
              toPath,
              statusCode,
              isActive: true,
            },
          });
          created += 1;
        }
        await this.invalidateRedirectCache(tenantId, fromPath);
      }
    });
    return { created, updated, errors };
  }

  /* ---------------- Public redirect check (Redis cached) ---------------- */

  async checkRedirect(
    tenantId: string,
    path: string,
  ): Promise<{ redirect: string; status: number } | null> {
    const key = this.redirectCacheKey(tenantId, path);
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        if (cached === '0') return null;
        try {
          return JSON.parse(cached) as { redirect: string; status: number };
        } catch {
          /* fall through */
        }
      }
    } catch (err) {
      this.logger.warn(`redis get redirect cache failed: ${(err as Error).message}`);
    }

    const row = await withTenant({ tenantId }, async (tx) => {
      return tx.redirect.findFirst({
        where: { tenantId, fromPath: path, isActive: true },
        select: { toPath: true, statusCode: true },
      });
    });

    const out = row
      ? { redirect: row.toPath, status: row.statusCode }
      : null;

    try {
      await this.redis.set(
        key,
        out ? JSON.stringify(out) : '0',
        'EX',
        REDIRECT_CACHE_TTL_SEC,
      );
    } catch (err) {
      this.logger.warn(`redis set redirect cache failed: ${(err as Error).message}`);
    }
    return out;
  }

  /* ---------------- SEO settings ---------------- */

  async getSettings() {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const row = await tx.seoSetting.findUnique({ where: { tenantId } });
      return (
        row ??
        {
          tenantId,
          defaultTitle: null,
          titleTemplate: '%s | %shopName',
          defaultDescription: null,
          defaultOgImage: null,
          robotsTxt: null,
          googleSiteVerification: null,
          bingSiteVerification: null,
          updatedAt: new Date(),
        }
      );
    });
  }

  async updateSettings(input: UpdateSeoSettingInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      return tx.seoSetting.upsert({
        where: { tenantId },
        update: {
          defaultTitle: input.defaultTitle ?? undefined,
          titleTemplate: input.titleTemplate ?? undefined,
          defaultDescription: input.defaultDescription ?? undefined,
          defaultOgImage: input.defaultOgImage ?? undefined,
          robotsTxt: input.robotsTxt ?? undefined,
          googleSiteVerification: input.googleSiteVerification ?? undefined,
          bingSiteVerification: input.bingSiteVerification ?? undefined,
        },
        create: {
          tenantId,
          defaultTitle: input.defaultTitle ?? null,
          titleTemplate: input.titleTemplate ?? '%s | %shopName',
          defaultDescription: input.defaultDescription ?? null,
          defaultOgImage: input.defaultOgImage ?? null,
          robotsTxt: input.robotsTxt ?? null,
          googleSiteVerification: input.googleSiteVerification ?? null,
          bingSiteVerification: input.bingSiteVerification ?? null,
        },
      });
    });
  }

  async getPublicSettings(tenantId: string) {
    return withTenant({ tenantId }, async (tx) => {
      return tx.seoSetting.findUnique({ where: { tenantId } });
    });
  }

  /* ---------------- sitemap.xml ---------------- */

  async buildSitemap(tenantId: string, baseUrl: string): Promise<string> {
    return withTenant({ tenantId }, async (tx) => {
      const [products, categories, pages] = await Promise.all([
        tx.product.findMany({
          where: { tenantId, status: 'active' },
          select: { slug: true, updatedAt: true },
          take: 5000,
          orderBy: { updatedAt: 'desc' },
        }),
        tx.category.findMany({
          where: { tenantId },
          select: { slug: true, updatedAt: true },
          take: 1000,
        }),
        tx.cmsPage.findMany({
          where: { tenantId, isPublished: true },
          select: { slug: true, updatedAt: true },
          take: 1000,
        }),
      ]);

      const urls: Array<{ loc: string; lastmod: Date; changefreq: string; priority: number }> = [];
      urls.push({ loc: `${baseUrl}/`, lastmod: new Date(), changefreq: 'daily', priority: 1.0 });
      urls.push({
        loc: `${baseUrl}/products`,
        lastmod: new Date(),
        changefreq: 'daily',
        priority: 0.9,
      });
      for (const p of products) {
        urls.push({
          loc: `${baseUrl}/products/${p.slug}`,
          lastmod: p.updatedAt,
          changefreq: 'weekly',
          priority: 0.8,
        });
      }
      for (const c of categories) {
        urls.push({
          loc: `${baseUrl}/c/${c.slug}`,
          lastmod: c.updatedAt,
          changefreq: 'weekly',
          priority: 0.7,
        });
      }
      for (const pg of pages) {
        urls.push({
          loc: `${baseUrl}/p/${pg.slug}`,
          lastmod: pg.updatedAt,
          changefreq: 'monthly',
          priority: 0.5,
        });
      }

      const body = urls
        .map(
          (u) =>
            `  <url>\n` +
            `    <loc>${escapeXml(u.loc)}</loc>\n` +
            `    <lastmod>${u.lastmod.toISOString()}</lastmod>\n` +
            `    <changefreq>${u.changefreq}</changefreq>\n` +
            `    <priority>${u.priority.toFixed(1)}</priority>\n` +
            `  </url>`,
        )
        .join('\n');
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
    });
  }

  buildRobotsTxt(custom: string | null, baseUrl: string): string {
    if (custom && custom.trim().length > 0) return custom.trim() + '\n';
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /account',
      'Disallow: /cart',
      'Disallow: /checkout',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
      '',
    ].join('\n');
  }

  /* ---------------- Cache helpers ---------------- */

  private redirectCacheKey(tenantId: string, path: string): string {
    return `seo:redirect:${tenantId}:${path}`;
  }

  private async invalidateRedirectCache(tenantId: string, path: string): Promise<void> {
    try {
      await this.redis.del(this.redirectCacheKey(tenantId, path));
    } catch (err) {
      this.logger.warn(
        `redis invalidate redirect failed: ${(err as Error).message}`,
      );
    }
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

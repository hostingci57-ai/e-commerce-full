import { Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/tenancy/tenancy.decorators';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { SeoService } from './seo.service';

@ApiTags('public/seo')
@Public()
@Controller('public')
export class SeoPublicController {
  constructor(
    private readonly seo: SeoService,
    private readonly ctx: TenantContextService,
  ) {}

  private requireTenant(): string {
    const tid = this.ctx.tenantId;
    if (!tid) {
      throw new NotFoundException({
        code: 'tenant_required',
        message: 'Tenant context required (missing X-Tenant-Subdomain)',
      });
    }
    return tid;
  }

  private baseUrl(): string {
    const env = process.env.NEXT_PUBLIC_STOREFRONT_URL;
    return env && env.length > 0 ? env.replace(/\/$/, '') : 'http://localhost:3000';
  }

  @ApiOperation({ summary: 'Check redirect for path (public)' })
  @Get('redirects/check')
  async checkRedirect(@Query('path') path?: string) {
    const tenantId = this.requireTenant();
    if (!path || !path.startsWith('/')) {
      return { redirect: null, status: null };
    }
    const result = await this.seo.checkRedirect(tenantId, path);
    if (!result) return { redirect: null, status: null };
    return result;
  }

  @ApiOperation({ summary: 'Public sitemap.xml' })
  @Get('sitemap.xml')
  async sitemap(@Res() reply: FastifyReply): Promise<void> {
    const tenantId = this.requireTenant();
    const xml = await this.seo.buildSitemap(tenantId, this.baseUrl());
    reply
      .header('content-type', 'application/xml; charset=utf-8')
      .header('cache-control', 'public, max-age=300')
      .send(xml);
  }

  @ApiOperation({ summary: 'Public robots.txt' })
  @Get('robots.txt')
  async robots(@Res() reply: FastifyReply): Promise<void> {
    const tenantId = this.requireTenant();
    const settings = await this.seo.getPublicSettings(tenantId);
    const body = this.seo.buildRobotsTxt(settings?.robotsTxt ?? null, this.baseUrl());
    reply
      .header('content-type', 'text/plain; charset=utf-8')
      .header('cache-control', 'public, max-age=300')
      .send(body);
  }

  @ApiOperation({ summary: 'Public SEO settings (public subset)' })
  @Get('seo/settings')
  async publicSettings() {
    const tenantId = this.requireTenant();
    const s = await this.seo.getPublicSettings(tenantId);
    if (!s) {
      return {
        defaultTitle: null,
        titleTemplate: '%s | %shopName',
        defaultDescription: null,
        defaultOgImage: null,
        googleSiteVerification: null,
        bingSiteVerification: null,
      };
    }
    return {
      defaultTitle: s.defaultTitle,
      titleTemplate: s.titleTemplate,
      defaultDescription: s.defaultDescription,
      defaultOgImage: s.defaultOgImage,
      googleSiteVerification: s.googleSiteVerification,
      bingSiteVerification: s.bingSiteVerification,
    };
  }
}

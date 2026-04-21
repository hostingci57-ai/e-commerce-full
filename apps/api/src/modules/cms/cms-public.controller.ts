import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/tenancy/tenancy.decorators';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { CmsService } from './cms.service';

const MENU_KEY_REGEX = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;

@ApiTags('public/cms')
@Public()
@Controller('public')
export class CmsPublicController {
  constructor(
    private readonly cms: CmsService,
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

  @ApiOperation({ summary: 'List published CMS pages (public)' })
  @Get('pages')
  listPages(@Query('location') location?: string) {
    const tenantId = this.requireTenant();
    const loc =
      location === 'header' || location === 'footer' ? location : undefined;
    return this.cms.listPublicPages(tenantId, loc);
  }

  @ApiOperation({ summary: 'Get published CMS page by slug (public)' })
  @Get('pages/:slug')
  getPage(@Param('slug') slug: string) {
    if (!SLUG_REGEX.test(slug)) {
      throw new NotFoundException({
        code: 'cms_page_not_found',
        message: 'Page not found',
      });
    }
    const tenantId = this.requireTenant();
    return this.cms.getPublicPageBySlug(tenantId, slug);
  }

  @ApiOperation({ summary: 'Get CMS menu by key (public)' })
  @Get('menus/:key')
  getMenu(@Param('key') key: string) {
    if (!MENU_KEY_REGEX.test(key)) {
      throw new NotFoundException({
        code: 'cms_menu_not_found',
        message: 'Menu not found',
      });
    }
    const tenantId = this.requireTenant();
    return this.cms.getPublicMenu(tenantId, key);
  }
}

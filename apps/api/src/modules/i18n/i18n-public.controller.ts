import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  GetBundleQuerySchema,
  type GetBundleQuery,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/tenancy/tenancy.decorators';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { I18nService } from './i18n.service';

@ApiTags('public/i18n')
@Public()
@Controller('public/i18n')
export class I18nPublicController {
  constructor(
    private readonly i18n: I18nService,
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

  @ApiOperation({ summary: 'Get a UI string bundle (public)' })
  @Get('bundle')
  getBundle(
    @Query(new ZodValidationPipe(GetBundleQuerySchema)) query: GetBundleQuery,
  ) {
    const tenantId = this.requireTenant();
    return this.i18n.getPublicBundle(tenantId, query.lang, query.ns);
  }

  @ApiOperation({ summary: 'List published tenant languages (public)' })
  @Get('languages')
  listLanguages() {
    const tenantId = this.requireTenant();
    return this.i18n.getTenantPublicLanguages(tenantId);
  }
}

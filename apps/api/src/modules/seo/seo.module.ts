import { Module } from '@nestjs/common';
import { RedirectsController } from './redirects.controller';
import { SeoSettingsController } from './seo-settings.controller';
import { SeoPublicController } from './seo-public.controller';
import { SeoService } from './seo.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    SeoService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [RedirectsController, SeoSettingsController, SeoPublicController],
  exports: [SeoService],
})
export class SeoModule {}

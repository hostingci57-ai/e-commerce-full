import { Module } from '@nestjs/common';
import { LanguagesController } from './languages.controller';
import { TenantLanguagesController } from './tenant-languages.controller';
import { BundlesController } from './bundles.controller';
import { I18nPublicController } from './i18n-public.controller';
import { I18nService } from './i18n.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    I18nService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [
    LanguagesController,
    TenantLanguagesController,
    BundlesController,
    I18nPublicController,
  ],
  exports: [I18nService],
})
export class I18nModule {}

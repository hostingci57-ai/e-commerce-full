import { Module } from '@nestjs/common';
import { CmsPagesController } from './cms-pages.controller';
import { CmsMenusController } from './cms-menus.controller';
import { CmsPublicController } from './cms-public.controller';
import { CmsService } from './cms.service';
import { CmsSeedService } from './cms-seed.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    CmsService,
    CmsSeedService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [CmsPagesController, CmsMenusController, CmsPublicController],
  exports: [CmsService, CmsSeedService],
})
export class CmsModule {}

import { Module } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';
import {
  TenantSettingsController,
  PublicTenantSettingsController,
} from './tenant-settings.controller';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AuthModule } from '../auth/auth.module';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { AbilityFactory } from '../../common/rbac/ability.factory';

@Module({
  imports: [AuthModule],
  providers: [
    TenantSettingsService,
    TenantContextService,
    JwtGuard,
    PermissionsGuard,
    AbilityFactory,
  ],
  controllers: [TenantSettingsController, PublicTenantSettingsController],
  exports: [TenantSettingsService],
})
export class TenantSettingsModule {}

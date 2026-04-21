import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { ShippingModule as CommonShippingModule } from '../../common/shipping/shipping.module';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AuthModule } from '../auth/auth.module';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { AbilityFactory } from '../../common/rbac/ability.factory';

@Module({
  imports: [CommonShippingModule, AuthModule],
  providers: [
    ShippingService,
    TenantContextService,
    JwtGuard,
    PermissionsGuard,
    AbilityFactory,
  ],
  controllers: [ShippingController],
  exports: [ShippingService],
})
export class ApiShippingModule {}

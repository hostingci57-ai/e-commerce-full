import { Module } from '@nestjs/common';
import { CustomersController } from './customers/customers.controller';
import { CustomersService } from './customers/customers.service';
import { AddressesController } from './addresses/addresses.controller';
import { AddressesService } from './addresses/addresses.service';
import { KvkkController } from './kvkk/kvkk.controller';
import { KvkkService } from './kvkk/kvkk.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    CustomersService,
    AddressesService,
    KvkkService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [CustomersController, AddressesController, KvkkController],
  exports: [CustomersService, AddressesService, KvkkService],
})
export class CustomersModule {}

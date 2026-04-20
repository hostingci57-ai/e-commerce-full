import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { DraftOrdersService } from './draft-orders.service';
import { OrdersController } from './orders.controller';
import { DraftOrdersController } from './draft-orders.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';
import { CouponsModule } from '../coupons/coupons.module';
import { RefundsModule } from '../refunds/refunds.module';

@Module({
  imports: [AuthModule, CouponsModule, RefundsModule],
  providers: [
    OrdersService,
    DraftOrdersService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [OrdersController, DraftOrdersController, CustomerOrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}

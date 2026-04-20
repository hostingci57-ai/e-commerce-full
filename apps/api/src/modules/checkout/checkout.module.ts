import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CartModule } from '../cart/cart.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CartModule, InventoryModule, OrdersModule, AuthModule],
  providers: [CheckoutService, TenantContextService],
  controllers: [CheckoutController],
  exports: [CheckoutService],
})
export class CheckoutModule {}

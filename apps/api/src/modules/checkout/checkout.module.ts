import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CartModule } from '../cart/cart.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { PaymentsModule } from '../payments/payments.module';
import { ShippingModule as CommonShippingModule } from '../../common/shipping/shipping.module';

@Module({
  imports: [CartModule, InventoryModule, OrdersModule, AuthModule, PaymentsModule, CommonShippingModule],
  providers: [CheckoutService, TenantContextService, OptionalJwtGuard],
  controllers: [CheckoutController],
  exports: [CheckoutService],
})
export class CheckoutModule {}

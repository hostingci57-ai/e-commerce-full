import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { AppConfigModule } from './common/config/config.module';
import { RedisModule } from './common/redis/redis.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { AppThrottlerModule } from './common/throttler/throttler.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CartModule } from './modules/cart/cart.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { RefundsModule } from './modules/refunds/refunds.module';

@Module({
  imports: [
    AppConfigModule,
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: (req) => (req.id as string) ?? crypto.randomUUID() },
    }),
    PrismaModule,
    RedisModule,
    OutboxModule,
    MetricsModule,
    AppThrottlerModule,
    TenancyModule,
    AuthModule,
    HealthModule,
    CatalogModule,
    CustomersModule,
    InventoryModule,
    CouponsModule,
    CartModule,
    OrdersModule,
    CheckoutModule,
    RefundsModule,
  ],
})
export class AppModule {}

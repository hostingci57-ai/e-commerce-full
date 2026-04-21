import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { AppConfigModule } from './common/config/config.module';
import { RedisModule } from './common/redis/redis.module';
import { QueueModule } from './common/queue/queue.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { EmailModule } from './common/email/email.module';
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
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [
    AppConfigModule,
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: (req) => (req.id as string) ?? crypto.randomUUID() },
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    OutboxModule,
    EmailModule,
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
    WebhooksModule,
    MediaModule,
  ],
})
export class AppModule {}

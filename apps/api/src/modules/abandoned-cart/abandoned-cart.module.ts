import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AbandonedCartController, CartRecoverController } from './abandoned-cart.controller';
import { AbandonedCartService } from './abandoned-cart.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CartTokenMiddleware } from '../cart/cart-token.middleware';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, CartModule],
  providers: [
    AbandonedCartService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
    OptionalJwtGuard,
    CartTokenMiddleware,
  ],
  controllers: [AbandonedCartController, CartRecoverController],
  exports: [AbandonedCartService],
})
export class AbandonedCartModule implements NestModule {
  /** /cart/recover/:token needs the cart_token cookie to resolve the guest owner. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CartTokenMiddleware).forRoutes('cart/recover', 'v1/cart/recover');
  }
}

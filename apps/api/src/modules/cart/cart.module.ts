import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartTokenMiddleware } from './cart-token.middleware';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    CartService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
    OptionalJwtGuard,
  ],
  controllers: [CartController],
  exports: [CartService],
})
export class CartModule implements NestModule {
  /**
   * cart_token cookie is issued by CartTokenMiddleware for cart + checkout
   * routes only — other API surfaces don't need the Set-Cookie overhead.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CartTokenMiddleware).forRoutes('cart', 'checkout', 'v1/cart', 'v1/checkout');
  }
}

import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [AuthModule, CartModule],
  providers: [
    WishlistService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [WishlistController],
  exports: [WishlistService],
})
export class WishlistModule {}

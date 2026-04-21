import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ProductReviewsController, ReviewsController } from './reviews.controller';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    ReviewsService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [ProductReviewsController, ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}

import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentModule } from '../../common/payment/payment.module';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AuthModule } from '../auth/auth.module';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { AbilityFactory } from '../../common/rbac/ability.factory';

@Module({
  imports: [PaymentModule, AuthModule],
  providers: [
    PaymentsService,
    TenantContextService,
    JwtGuard,
    PermissionsGuard,
    AbilityFactory,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}

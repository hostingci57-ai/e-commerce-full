import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantResolverMiddleware } from '../../common/tenancy/tenant-resolver.middleware';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PasswordService } from '../auth/password.service';

@Module({
  providers: [
    TenantContextService,
    TenantService,
    PlanService,
    AbilityFactory,
    PasswordService,
  ],
  controllers: [TenantController, PlanController],
  exports: [TenantContextService, TenantService, PlanService, AbilityFactory],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantResolverMiddleware).forRoutes('*');
  }
}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantResolverMiddleware } from '../../common/tenancy/tenant-resolver.middleware';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';

@Module({
  providers: [TenantContextService, TenantService, AbilityFactory],
  controllers: [TenantController],
  exports: [TenantContextService, TenantService, AbilityFactory],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantResolverMiddleware).forRoutes('*');
  }
}

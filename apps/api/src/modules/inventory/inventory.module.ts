import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { LowStockSchedulerService } from './low-stock-scheduler.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule],
  providers: [
    InventoryService,
    LowStockSchedulerService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}

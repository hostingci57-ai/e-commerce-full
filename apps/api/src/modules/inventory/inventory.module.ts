import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Module({
  providers: [InventoryService, TenantContextService],
  exports: [InventoryService],
})
export class InventoryModule {}

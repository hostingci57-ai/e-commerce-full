import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdjustStockSchema,
  BulkImportSchema,
  ListInventoryLevelsQuerySchema,
  ListMovementsQuerySchema,
  UpdateInventoryLevelSchema,
  type AdjustStockInput,
  type BulkImportInput,
  type ListInventoryLevelsQuery,
  type ListMovementsQuery,
  type UpdateInventoryLevelInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { InventoryService } from './inventory.service';

/**
 * Admin inventory endpoints. Customer-facing reads go through the catalog
 * product endpoints (which include the per-variant stock in their response).
 */
@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(JwtGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @ApiOperation({ summary: 'List inventory levels (paginated, filter low-stock/oos)' })
  @CheckAbility({ action: 'read', subject: 'Inventory' })
  @Get('levels')
  listLevels(
    @Query(new ZodValidationPipe(ListInventoryLevelsQuerySchema)) q: ListInventoryLevelsQuery,
  ) {
    return this.inventory.listLevels(q);
  }

  @ApiOperation({ summary: 'Low-stock summary (all variants at/below threshold)' })
  @CheckAbility({ action: 'read', subject: 'Inventory' })
  @Get('low-stock')
  listLowStock() {
    return this.inventory.listLowStock();
  }

  @ApiOperation({ summary: 'Get current stock for a variant' })
  @CheckAbility({ action: 'read', subject: 'Inventory' })
  @Get('levels/:variantId')
  getLevel(@Param('variantId', new ParseUUIDPipe()) variantId: string) {
    return this.inventory.getCurrentStock(variantId);
  }

  @ApiOperation({ summary: 'Update a variant low-stock threshold' })
  @CheckAbility({ action: 'update', subject: 'Inventory' })
  @Patch('levels/:variantId')
  updateLevel(
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body(new ZodValidationPipe(UpdateInventoryLevelSchema)) body: UpdateInventoryLevelInput,
  ) {
    return this.inventory.updateThreshold(variantId, body);
  }

  @ApiOperation({ summary: 'Adjust stock (+/- delta) — always append-only audit' })
  @CheckAbility({ action: 'update', subject: 'Inventory' })
  @Post('adjust')
  adjust(@Body(new ZodValidationPipe(AdjustStockSchema)) body: AdjustStockInput) {
    return this.inventory.adjust(body);
  }

  @ApiOperation({ summary: 'Movement history (filter by variant/type/date)' })
  @CheckAbility({ action: 'read', subject: 'Inventory' })
  @Get('movements')
  listMovements(
    @Query(new ZodValidationPipe(ListMovementsQuerySchema)) q: ListMovementsQuery,
  ) {
    return this.inventory.listMovements(q);
  }

  @ApiOperation({ summary: 'Bulk import stock by SKU' })
  @CheckAbility({ action: 'update', subject: 'Inventory' })
  @Post('bulk-import')
  bulkImport(@Body(new ZodValidationPipe(BulkImportSchema)) body: BulkImportInput) {
    return this.inventory.bulkImport(body);
  }

  @ApiOperation({ summary: 'Export current inventory as CSV' })
  @CheckAbility({ action: 'read', subject: 'Inventory' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inventory.csv"')
  @Get('export.csv')
  async exportCsv(@Res() reply: FastifyReply) {
    // Dump everything up to a hard cap; 5k rows ≈ <500KB of CSV and covers
    // any realistic tenant catalog without streaming.
    const { items } = await this.inventory.listLevels({
      page: 1,
      limit: 5000,
    } as ListInventoryLevelsQuery);
    const header =
      'sku,product_title,stock_on_hand,stock_reserved,available,low_stock_threshold,status';
    const escape = (s: string | number): string => {
      const v = String(s);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const rows = items.map((i) =>
      [
        escape(i.sku),
        escape(i.productTitle),
        escape(i.stockOnHand),
        escape(i.stockReserved),
        escape(i.available),
        escape(i.lowStockThreshold),
        escape(i.status),
      ].join(','),
    );
    return reply.send([header, ...rows].join('\n'));
  }
}

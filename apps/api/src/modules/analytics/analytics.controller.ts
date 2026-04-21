import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { AnalyticsService } from './analytics.service';
import type { Granularity } from './analytics.types';

/**
 * Dashboard analytics endpoints — all tenant-scoped and staff-only.
 *
 * Query parameters are parsed as loose strings here so the controller stays
 * light; AnalyticsService.resolveRange does validation and `BadRequestException`
 * on malformed timestamps.
 */
@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @ApiOperation({ summary: 'Headline KPIs for the dashboard' })
  @CheckAbility({ action: 'read', subject: 'Analytics' })
  @Get('kpis')
  kpis(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.getKpis({ from, to });
  }

  @ApiOperation({ summary: 'Revenue time-series bucketed by day/week/month' })
  @CheckAbility({ action: 'read', subject: 'Analytics' })
  @Get('revenue-series')
  revenueSeries(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: Granularity,
  ) {
    const g: Granularity =
      granularity === 'week' || granularity === 'month' ? granularity : 'day';
    return this.analytics.getRevenueTimeSeries({ from, to, granularity: g });
  }

  @ApiOperation({ summary: 'Best-selling products by revenue' })
  @CheckAbility({ action: 'read', subject: 'Analytics' })
  @Get('top-products')
  topProducts(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.analytics.getTopProducts({
      from,
      to,
      limit: Number.isFinite(parsed) ? (parsed as number) : undefined,
    });
  }

  @ApiOperation({ summary: 'Top customers by lifetime-value' })
  @CheckAbility({ action: 'read', subject: 'Analytics' })
  @Get('top-customers')
  topCustomers(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.analytics.getTopCustomers({
      from,
      to,
      limit: Number.isFinite(parsed) ? (parsed as number) : undefined,
    });
  }

  @ApiOperation({ summary: 'Revenue broken down by category' })
  @CheckAbility({ action: 'read', subject: 'Analytics' })
  @Get('sales-by-category')
  salesByCategory(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.getSalesByCategory({ from, to });
  }

  @ApiOperation({ summary: 'Order status histogram' })
  @CheckAbility({ action: 'read', subject: 'Analytics' })
  @Get('orders-by-status')
  ordersByStatus(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.getOrdersByStatus({ from, to });
  }

  @ApiOperation({ summary: 'Operational alert counters (dashboard widget)' })
  @CheckAbility({ action: 'read', subject: 'Analytics' })
  @Get('alerts')
  alerts() {
    return this.analytics.getAlerts();
  }
}

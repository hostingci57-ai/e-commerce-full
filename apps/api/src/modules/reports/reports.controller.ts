import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { ReportsService } from './reports.service';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function attachCsvHeaders(reply: FastifyReply, filename: string): void {
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  );
  // Prevent proxies from transforming the stream body.
  reply.header('Cache-Control', 'no-store');
}

/**
 * CSV report endpoints. Responses are streamed via `reply.send(readable)` so we
 * don't buffer whole result sets in memory. All routes require staff + the
 * `read Report` ability (wired on OWNER/ADMIN/VIEWER and ORDER_OPERATOR).
 */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @ApiOperation({ summary: 'Orders export (CSV)' })
  @CheckAbility({ action: 'read', subject: 'Report' })
  @Get('orders.csv')
  orders(
    @Res() reply: FastifyReply,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    attachCsvHeaders(reply, `orders-${today()}.csv`);
    const stream = this.reports.ordersStream({ from, to, status });
    return reply.send(stream);
  }

  @ApiOperation({ summary: 'Daily sales aggregate (CSV)' })
  @CheckAbility({ action: 'read', subject: 'Report' })
  @Get('sales.csv')
  sales(
    @Res() reply: FastifyReply,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    attachCsvHeaders(reply, `sales-${today()}.csv`);
    const stream = this.reports.salesStream({ from, to });
    return reply.send(stream);
  }

  @ApiOperation({ summary: 'Customers (LTV) export (CSV)' })
  @CheckAbility({ action: 'read', subject: 'Report' })
  @Get('customers.csv')
  customers(@Res() reply: FastifyReply) {
    attachCsvHeaders(reply, `customers-${today()}.csv`);
    const stream = this.reports.customersStream();
    return reply.send(stream);
  }
}

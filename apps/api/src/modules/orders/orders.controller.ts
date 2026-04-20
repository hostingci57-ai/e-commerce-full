import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CancelOrderSchema,
  CreateShipmentSchema,
  ListOrdersQuerySchema,
  UpdateOrderStatusSchema,
  type CancelOrderInput,
  type CreateShipmentInput,
  type ListOrdersQuery,
  type UpdateOrderStatusInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { OrdersService } from './orders.service';

/**
 * Admin / staff-facing order endpoints. Customer-facing routes live in
 * CustomerOrdersController to keep the path-based RBAC tidy.
 */
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @ApiOperation({ summary: 'List orders (admin)' })
  @CheckAbility({ action: 'read', subject: 'Order' })
  @Get()
  list(@Query(new ZodValidationPipe(ListOrdersQuerySchema)) q: ListOrdersQuery) {
    return this.orders.list(q);
  }

  @ApiOperation({ summary: 'Get order detail' })
  @CheckAbility({ action: 'read', subject: 'Order' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.findById(id);
  }

  @ApiOperation({ summary: 'Update order status (admin — state machine enforced)' })
  @CheckAbility({ action: 'update', subject: 'Order' })
  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateOrderStatusSchema)) body: UpdateOrderStatusInput,
  ) {
    return this.orders.updateStatus(id, body);
  }

  @ApiOperation({ summary: 'Cancel order (admin)' })
  @CheckAbility({ action: 'update', subject: 'Order' })
  @Post(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CancelOrderSchema)) body: CancelOrderInput,
  ) {
    return this.orders.cancel(id, body, 'admin');
  }

  @ApiOperation({ summary: 'Create shipment (admin) — transitions to shipped' })
  @CheckAbility({ action: 'update', subject: 'Order' })
  @Post(':id/shipments')
  createShipment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateShipmentSchema)) body: CreateShipmentInput,
  ) {
    return this.orders.createShipment(id, body);
  }
}

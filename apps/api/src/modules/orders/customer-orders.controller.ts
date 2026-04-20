import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CancelOrderSchema,
  ListOrdersQuerySchema,
  RefundRequestSchema,
  type CancelOrderInput,
  type ListOrdersQuery,
  type RefundRequestInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { OrdersService } from './orders.service';
import { RefundsService } from '../refunds/refunds.service';

/**
 * Customer-side order views + self-service mutations (cancel / refund).
 */
@ApiTags('customer-orders')
@ApiBearerAuth()
@Controller('customers/me/orders')
@UseGuards(JwtGuard, PermissionsGuard)
export class CustomerOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly refunds: RefundsService,
  ) {}

  @ApiOperation({ summary: "List the authenticated customer's orders" })
  @CheckAbility({ action: 'read', subject: 'Order' })
  @Get()
  list(@Query(new ZodValidationPipe(ListOrdersQuerySchema)) q: ListOrdersQuery) {
    return this.orders.listMine(q);
  }

  @ApiOperation({ summary: 'Get one of my orders' })
  @CheckAbility({ action: 'read', subject: 'Order' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.findMine(id);
  }

  @ApiOperation({ summary: 'Cancel one of my orders (while cancelable)' })
  @CheckAbility({ action: 'update', subject: 'Order' })
  @Post(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CancelOrderSchema)) body: CancelOrderInput,
  ) {
    return this.orders.cancel(id, body, 'customer');
  }

  @ApiOperation({ summary: 'Request a refund for one of my orders (FSD 5.3.4)' })
  @CheckAbility({ action: 'update', subject: 'Order' })
  @Post(':id/refund-request')
  refundRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(RefundRequestSchema)) body: RefundRequestInput,
  ) {
    return this.refunds.createRequest(id, body);
  }
}

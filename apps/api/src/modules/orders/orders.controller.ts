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
  CreateProviderShipmentSchema,
  CreateShipmentSchema,
  ListOrdersQuerySchema,
  UpdateOrderStatusSchema,
  type CancelOrderInput,
  type CreateProviderShipmentInput,
  type CreateShipmentInput,
  type ListOrdersQuery,
  type UpdateOrderStatusInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ShippingService } from '../shipping/shipping.service';

/**
 * Admin / staff-facing order endpoints. Customer-facing routes live in
 * CustomerOrdersController to keep the path-based RBAC tidy.
 */
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtGuard, PermissionsGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly shipping: ShippingService,
  ) {}

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

  @ApiOperation({ summary: 'Legacy create shipment (admin) — transitions to shipped' })
  @CheckAbility({ action: 'update', subject: 'Order' })
  @Post(':id/shipments/legacy')
  createShipmentLegacy(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateShipmentSchema)) body: CreateShipmentInput,
  ) {
    return this.orders.createShipment(id, body);
  }

  /**
   * New provider-aware shipment endpoint. Uses ShippingService (picks the
   * configured provider) and also transitions the order to 'shipped'
   * when a tracking number is supplied.
   */
  @ApiOperation({ summary: 'Create shipment via shipping provider' })
  @CheckAbility({ action: 'update', subject: 'Shipment' })
  @Post(':id/shipments')
  async createShipment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateProviderShipmentSchema))
    body: CreateProviderShipmentInput,
  ) {
    const shipment = await this.shipping.createShipment(id, body);
    // If tracking arrived, transition the order to shipped for convenience.
    if (body.trackingNumber) {
      try {
        await this.orders.createShipment(id, {
          carrier: body.providerCode,
          trackingNumber: body.trackingNumber,
          note: body.note,
        });
      } catch {
        /* Order may not be in 'preparing' — that's fine; admin can transition manually. */
      }
    }
    return shipment;
  }

  @ApiOperation({ summary: 'List shipments attached to an order' })
  @CheckAbility({ action: 'read', subject: 'Order' })
  @Get(':id/shipments')
  listShipments(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.shipping.listShipmentsForOrder(id);
  }

  /**
   * Approve a pending (bank_transfer / manual) payment. Flips the Payment
   * row to CAPTURED via provider.capture() and transitions the order
   * to payment_success.
   */
  @ApiOperation({ summary: 'Approve / capture pending payment for an order' })
  @CheckAbility({ action: 'update', subject: 'Payment' })
  @Post(':id/payment/capture')
  async capturePayment(@Param('id', new ParseUUIDPipe()) id: string) {
    const payment = await this.payments.findByOrderId(id);
    if (!payment) {
      return { ok: false, code: 'payment_not_found' };
    }
    const updated = await this.payments.capturePayment(payment.id);
    if (updated.status === 'CAPTURED') {
      try {
        await this.orders.updateStatus(id, {
          to: 'payment_success',
          note: `Payment captured via ${updated.providerCode}`,
        });
      } catch {
        /* already in a later state — ignore */
      }
    }
    return {
      payment: {
        id: updated.id,
        status: updated.status,
        providerCode: updated.providerCode,
        providerRef: updated.providerRef,
        amount: updated.amount.toString(),
      },
    };
  }
}

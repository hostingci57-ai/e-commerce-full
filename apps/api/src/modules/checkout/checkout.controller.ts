import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import {
  CheckoutAddressSchema,
  CompleteCheckoutSchema,
  SetPaymentSchema,
  SetShippingSchema,
  StartCheckoutSchema,
  type CheckoutAddressInput,
  type CompleteCheckoutInput,
  type SetPaymentInput,
  type SetShippingInput,
  type StartCheckoutInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CartService } from '../cart/cart.service';
import { getCartToken } from '../cart/cart-token.middleware';
import { CheckoutService } from './checkout.service';
import { PaymentsService } from '../payments/payments.service';

@ApiTags('checkout')
@UseGuards(OptionalJwtGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly cart: CartService,
    private readonly checkout: CheckoutService,
    private readonly payments: PaymentsService,
  ) {}

  @ApiOperation({ summary: 'Start checkout — snapshots cart and reserves inventory (15m)' })
  @HttpCode(HttpStatus.CREATED)
  @Post('start')
  async start(
    @Req() req: FastifyRequest,
    @Body(new ZodValidationPipe(StartCheckoutSchema)) body: StartCheckoutInput,
  ) {
    const owner = this.cart.resolveOwner(getCartToken(req));
    return this.checkout.start(owner, body);
  }

  @ApiOperation({ summary: 'Retrieve an open checkout session' })
  @Get(':token')
  get(@Param('token') token: string) {
    return this.checkout.get(token);
  }

  @ApiOperation({ summary: 'List available shipping rates for the session' })
  @Get(':token/shipping-rates')
  rates(@Param('token') token: string) {
    return this.checkout.getShippingRates(token);
  }

  @ApiOperation({ summary: 'List available payment methods for current tenant' })
  @Get(':token/payment-methods')
  methods() {
    return this.payments.listAvailableForTenant();
  }

  @ApiOperation({ summary: 'Set the shipping address' })
  @Post(':token/address')
  setAddress(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(CheckoutAddressSchema)) body: CheckoutAddressInput,
  ) {
    return this.checkout.setAddress(token, 'shipping', body);
  }

  @ApiOperation({
    summary: 'Set the shipping method (accepts legacy {method} or {providerCode,rateCode})',
  })
  @Post(':token/shipping')
  setShipping(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(SetShippingSchema)) body: SetShippingInput,
  ) {
    return this.checkout.setShipping(token, body);
  }

  @ApiOperation({ summary: 'Set the payment method (accepts legacy {method} or {providerCode})' })
  @Post(':token/payment')
  setPayment(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(SetPaymentSchema)) body: SetPaymentInput,
  ) {
    return this.checkout.setPayment(token, body);
  }

  @ApiOperation({ summary: 'Complete checkout — creates the order and initializes payment' })
  @HttpCode(HttpStatus.CREATED)
  @Post(':token/complete')
  complete(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(CompleteCheckoutSchema)) _body: CompleteCheckoutInput,
  ) {
    return this.checkout.complete(token);
  }
}

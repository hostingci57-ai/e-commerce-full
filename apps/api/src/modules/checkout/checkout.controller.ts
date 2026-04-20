import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { Public } from '../../common/tenancy/tenancy.decorators';
import { CartService } from '../cart/cart.service';
import { getCartToken } from '../cart/cart-token.middleware';
import { CheckoutService } from './checkout.service';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly cart: CartService,
    private readonly checkout: CheckoutService,
  ) {}

  @ApiOperation({ summary: 'Start checkout — snapshots cart and reserves inventory (15m)' })
  @Public()
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
  @Public()
  @Get(':token')
  get(@Param('token') token: string) {
    return this.checkout.get(token);
  }

  @ApiOperation({ summary: 'Set the shipping address (or billing=?kind=billing)' })
  @Public()
  @Post(':token/address')
  setAddress(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(CheckoutAddressSchema)) body: CheckoutAddressInput,
  ) {
    return this.checkout.setAddress(token, 'shipping', body);
  }

  @ApiOperation({ summary: 'Set the shipping method (standard|express)' })
  @Public()
  @Post(':token/shipping')
  setShipping(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(SetShippingSchema)) body: SetShippingInput,
  ) {
    return this.checkout.setShipping(token, body);
  }

  @ApiOperation({ summary: 'Set the payment method (stub provider only)' })
  @Public()
  @Post(':token/payment')
  setPayment(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(SetPaymentSchema)) body: SetPaymentInput,
  ) {
    return this.checkout.setPayment(token, body);
  }

  @ApiOperation({ summary: 'Complete checkout — creates the order and decrements stock' })
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post(':token/complete')
  complete(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(CompleteCheckoutSchema)) _body: CompleteCheckoutInput,
  ) {
    return this.checkout.complete(token);
  }
}

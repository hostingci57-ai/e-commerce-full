import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  AddCartItemSchema,
  ApplyCouponSchema,
  MergeCartSchema,
  UpdateCartItemSchema,
  type AddCartItemInput,
  type ApplyCouponInput,
  type MergeCartInput,
  type UpdateCartItemInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { Public } from '../../common/tenancy/tenancy.decorators';
import { CartService } from './cart.service';
import { getCartToken } from './cart-token.middleware';
import { serializeCart } from './cart.serializer';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @ApiOperation({ summary: 'Get the current cart (guest via cookie, member via JWT)' })
  @Public()
  @Get()
  async get(@Req() req: FastifyRequest) {
    const owner = this.cart.resolveOwner(getCartToken(req));
    return serializeCart(await this.cart.load(owner));
  }

  @ApiOperation({ summary: 'Add an item to the cart' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('items')
  async addItem(
    @Req() req: FastifyRequest,
    @Body(new ZodValidationPipe(AddCartItemSchema)) body: AddCartItemInput,
  ) {
    const owner = this.cart.resolveOwner(getCartToken(req));
    return serializeCart(await this.cart.addItem(owner, body.variantId, body.quantity));
  }

  @ApiOperation({ summary: 'Update quantity of a cart line' })
  @Public()
  @Patch('items/:variantId')
  async updateItem(
    @Req() req: FastifyRequest,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body(new ZodValidationPipe(UpdateCartItemSchema)) body: UpdateCartItemInput,
  ) {
    const owner = this.cart.resolveOwner(getCartToken(req));
    return serializeCart(await this.cart.updateQuantity(owner, variantId, body.quantity));
  }

  @ApiOperation({ summary: 'Remove an item from the cart' })
  @Public()
  @Delete('items/:variantId')
  async removeItem(
    @Req() req: FastifyRequest,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ) {
    const owner = this.cart.resolveOwner(getCartToken(req));
    return serializeCart(await this.cart.removeItem(owner, variantId));
  }

  // --- Member-only: cart merge on login -------------------------------------

  @ApiOperation({ summary: 'Merge a guest cart into the authenticated member cart' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'update', subject: 'Cart' })
  @HttpCode(HttpStatus.OK)
  @Post('merge')
  async merge(
    @Req() req: FastifyRequest,
    @Body(new ZodValidationPipe(MergeCartSchema)) body: MergeCartInput,
  ) {
    const owner = this.cart.resolveOwner(getCartToken(req));
    return serializeCart(await this.cart.merge(owner, body.guestCartToken));
  }

  // --- Coupons (stubbed) ---------------------------------------------------

  @ApiOperation({ summary: 'Apply a coupon code (stub — returns 400)' })
  @Public()
  @Post('coupon')
  async applyCoupon(
    @Req() req: FastifyRequest,
    @Body(new ZodValidationPipe(ApplyCouponSchema)) body: ApplyCouponInput,
  ) {
    const owner = this.cart.resolveOwner(getCartToken(req));
    return serializeCart(await this.cart.applyCoupon(owner, body.code));
  }

  @ApiOperation({ summary: 'Remove an applied coupon' })
  @Public()
  @Delete('coupon/:code')
  async removeCoupon(@Req() req: FastifyRequest, @Param('code') code: string) {
    const owner = this.cart.resolveOwner(getCartToken(req));
    return serializeCart(await this.cart.removeCoupon(owner, code));
  }
}

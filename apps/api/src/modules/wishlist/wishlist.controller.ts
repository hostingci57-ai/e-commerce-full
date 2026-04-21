import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddToWishlistSchema, type AddToWishlistInput } from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('customers/me/wishlist')
@UseGuards(JwtGuard, PermissionsGuard)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @ApiOperation({ summary: 'List the authenticated customer wishlist' })
  @CheckAbility({ action: 'read', subject: 'WishlistItem' })
  @Get()
  list() {
    return this.wishlist.list();
  }

  @ApiOperation({ summary: 'Add a product to the wishlist (idempotent)' })
  @CheckAbility({ action: 'create', subject: 'WishlistItem' })
  @HttpCode(HttpStatus.OK)
  @Post()
  add(@Body(new ZodValidationPipe(AddToWishlistSchema)) body: AddToWishlistInput) {
    return this.wishlist.add(body);
  }

  @ApiOperation({ summary: 'Move all in-stock wishlist items into the cart' })
  @CheckAbility({ action: 'create', subject: 'WishlistItem' })
  @HttpCode(HttpStatus.OK)
  @Post('move-to-cart')
  moveToCart() {
    return this.wishlist.moveToCart();
  }

  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  @CheckAbility({ action: 'delete', subject: 'WishlistItem' })
  @Delete(':productId')
  remove(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return this.wishlist.remove(productId);
  }
}

import {
  Body,
  Controller,
  Delete,
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
  CreateCouponSchema,
  ListCouponsQuerySchema,
  UpdateCouponSchema,
  type CreateCouponInput,
  type ListCouponsQuery,
  type UpdateCouponInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { CouponsService } from './coupons.service';

/**
 * Admin coupons endpoints. Customer-side application goes through
 * CartController.applyCoupon (see cart module).
 */
@ApiTags('coupons')
@ApiBearerAuth()
@Controller('coupons')
@UseGuards(JwtGuard, PermissionsGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @ApiOperation({ summary: 'Create coupon (admin)' })
  @CheckAbility({ action: 'create', subject: 'Coupon' })
  @Post()
  create(@Body(new ZodValidationPipe(CreateCouponSchema)) body: CreateCouponInput) {
    return this.coupons.create(body);
  }

  @ApiOperation({ summary: 'List coupons (admin)' })
  @CheckAbility({ action: 'read', subject: 'Coupon' })
  @Get()
  list(@Query(new ZodValidationPipe(ListCouponsQuerySchema)) q: ListCouponsQuery) {
    return this.coupons.list(q);
  }

  @ApiOperation({ summary: 'Get coupon by id (admin)' })
  @CheckAbility({ action: 'read', subject: 'Coupon' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.coupons.findById(id);
  }

  @ApiOperation({ summary: 'Update coupon (admin)' })
  @CheckAbility({ action: 'update', subject: 'Coupon' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateCouponSchema)) body: UpdateCouponInput,
  ) {
    return this.coupons.update(id, body);
  }

  @ApiOperation({ summary: 'Deactivate coupon (admin, soft delete)' })
  @CheckAbility({ action: 'delete', subject: 'Coupon' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.coupons.softDelete(id);
  }
}

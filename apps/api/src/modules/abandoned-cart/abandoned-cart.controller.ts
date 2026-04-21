import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { getCartToken } from '../cart/cart-token.middleware';
import { AbandonedCartService } from './abandoned-cart.service';

const ListQuerySchema = z.object({
  recovered: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return 20;
      const n = typeof v === 'string' ? parseInt(v, 10) : v;
      return Math.min(100, Math.max(1, n));
    }),
  cursor: z.string().max(200).optional(),
});
type ListQuery = z.infer<typeof ListQuerySchema>;

@ApiTags('abandoned-carts')
@ApiBearerAuth()
@Controller('marketing/abandoned-carts')
@UseGuards(JwtGuard, PermissionsGuard)
export class AbandonedCartController {
  constructor(private readonly service: AbandonedCartService) {}

  @ApiOperation({ summary: 'List abandoned carts for the tenant' })
  @CheckAbility({ action: 'read', subject: 'AbandonedCart' })
  @Get()
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: ListQuery) {
    return this.service.list(q);
  }

  @ApiOperation({ summary: 'Send a manual recovery email for a given abandoned cart' })
  @CheckAbility({ action: 'update', subject: 'AbandonedCart' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/send-email')
  sendEmail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.sendManualRecovery(id);
  }
}

/**
 * Storefront-facing recover endpoint. Mounted under `/cart/recover/:token` so
 * the recovery email's URL can use the familiar cart path. Uses the optional
 * JWT guard so both guests (cart_token cookie) and members can recover.
 */
@ApiTags('cart')
@Controller('cart/recover')
@UseGuards(OptionalJwtGuard)
export class CartRecoverController {
  constructor(
    private readonly service: AbandonedCartService,
    private readonly ctx: TenantContextService,
  ) {}

  @ApiOperation({ summary: 'Restore an abandoned cart snapshot into the active cart' })
  @HttpCode(HttpStatus.OK)
  @Post(':token')
  recover(@Req() req: FastifyRequest, @Param('token') token: string) {
    const tenantId = this.ctx.tenantId;
    if (!tenantId) {
      return { recovered: false, items: 0, reason: 'tenant_required' };
    }
    return this.service.resumeForCurrentCart({
      tenantId,
      recoverToken: decodeURIComponent(token),
      activeCartToken: getCartToken(req),
    });
  }
}


import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PaymentMethodConfigSchema,
  UpdatePaymentMethodConfigSchema,
  type PaymentMethodConfigInput,
  type UpdatePaymentMethodConfigInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { PaymentRegistryService } from '../../common/payment/payment-registry.service';
import { PaymentsService } from './payments.service';

/**
 * Admin endpoints for payment method config. Mount point:
 *   /v1/tenant/payment-methods
 *
 * Storefront checkout relies on the list returned by
 * GET /v1/tenant/payment-methods/available which is open to any cart
 * that has a tenant context (no auth required).
 */
@ApiTags('payments')
@ApiBearerAuth()
@Controller('tenant/payment-methods')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly registry: PaymentRegistryService,
  ) {}

  @ApiOperation({ summary: 'List built-in payment providers (platform catalogue)' })
  @Get('providers')
  listProviders() {
    return this.registry.listBuiltIn();
  }

  @ApiOperation({ summary: 'Available payment methods for current tenant (public-ish)' })
  @Get('available')
  async listAvailable() {
    return this.payments.listAvailableForTenant();
  }

  @ApiOperation({ summary: 'List configured payment methods (admin)' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Get()
  list() {
    return this.payments.listConfigs();
  }

  @ApiOperation({ summary: 'Create or update (upsert by providerCode) a payment method config' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Post()
  upsert(
    @Body(new ZodValidationPipe(PaymentMethodConfigSchema))
    body: PaymentMethodConfigInput,
  ) {
    return this.payments.upsertConfig(body);
  }

  @ApiOperation({ summary: 'Patch a payment method config by id' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdatePaymentMethodConfigSchema))
    body: UpdatePaymentMethodConfigInput,
  ) {
    return this.payments.updateConfig(id, body);
  }

  @ApiOperation({ summary: 'Delete a payment method config' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.payments.deleteConfig(id);
  }
}

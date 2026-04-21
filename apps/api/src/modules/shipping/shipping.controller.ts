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
  ShippingMethodConfigSchema,
  UpdateShippingMethodConfigSchema,
  type ShippingMethodConfigInput,
  type UpdateShippingMethodConfigInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { ShippingRegistryService } from '../../common/shipping/shipping-registry.service';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@ApiBearerAuth()
@Controller('tenant/shipping-methods')
export class ShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly registry: ShippingRegistryService,
  ) {}

  @ApiOperation({ summary: 'List built-in shipping providers (platform catalogue)' })
  @Get('providers')
  listProviders() {
    return this.registry.listBuiltIn();
  }

  @ApiOperation({ summary: 'List configured shipping methods (admin)' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Get()
  list() {
    return this.shipping.listConfigs();
  }

  @ApiOperation({ summary: 'Create or update shipping method (upsert by provider+code)' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Post()
  upsert(
    @Body(new ZodValidationPipe(ShippingMethodConfigSchema))
    body: ShippingMethodConfigInput,
  ) {
    return this.shipping.upsertConfig(body);
  }

  @ApiOperation({ summary: 'Patch a shipping method config by id' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateShippingMethodConfigSchema))
    body: UpdateShippingMethodConfigInput,
  ) {
    return this.shipping.updateConfig(id, body);
  }

  @ApiOperation({ summary: 'Delete a shipping method config' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.shipping.deleteConfig(id);
  }
}

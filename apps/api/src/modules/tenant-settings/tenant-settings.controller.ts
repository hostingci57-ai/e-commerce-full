import {
  Body,
  Controller,
  Get,
  Header,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UpdateTenantSettingsSchema,
  type UpdateTenantSettingsInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { TenantSettingsService } from './tenant-settings.service';

/**
 * Admin-side tenant settings endpoints. Split into two controllers so
 * the public one is trivially identifiable + not guarded.
 */
@ApiTags('tenant-settings')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('tenant/settings')
export class TenantSettingsController {
  constructor(private readonly settings: TenantSettingsService) {}

  @ApiOperation({ summary: 'Get current tenant settings' })
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Get()
  get() {
    return this.settings.getOrCreate();
  }

  @ApiOperation({ summary: 'Update tenant settings' })
  @CheckAbility({ action: 'manage', subject: 'Settings' })
  @Patch()
  update(
    @Body(new ZodValidationPipe(UpdateTenantSettingsSchema))
    body: UpdateTenantSettingsInput,
  ) {
    return this.settings.update(body);
  }
}

/**
 * Public storefront endpoint — limited fields, cached.
 */
@ApiTags('tenant-settings')
@Controller('public/tenant')
export class PublicTenantSettingsController {
  constructor(private readonly settings: TenantSettingsService) {}

  @ApiOperation({ summary: 'Public tenant info for storefront (logo, colors, store name)' })
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  @Get('info')
  info() {
    return this.settings.getPublic();
  }
}

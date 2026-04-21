import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UpdateSeoSettingSchema,
  type UpdateSeoSettingInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { SeoService } from './seo.service';

@ApiTags('seo/settings')
@ApiBearerAuth()
@Controller('seo/settings')
@UseGuards(JwtGuard, PermissionsGuard)
export class SeoSettingsController {
  constructor(private readonly seo: SeoService) {}

  @ApiOperation({ summary: 'Get SEO settings for tenant (admin)' })
  @CheckAbility({ action: 'read', subject: 'SeoSetting' })
  @Get()
  get() {
    return this.seo.getSettings();
  }

  @ApiOperation({ summary: 'Update SEO settings for tenant (admin)' })
  @CheckAbility({ action: 'update', subject: 'SeoSetting' })
  @Patch()
  update(
    @Body(new ZodValidationPipe(UpdateSeoSettingSchema))
    body: UpdateSeoSettingInput,
  ) {
    return this.seo.updateSettings(body);
  }
}

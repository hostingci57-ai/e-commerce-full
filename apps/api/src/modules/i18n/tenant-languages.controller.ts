import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UpsertTenantLanguageSchema,
  type UpsertTenantLanguageInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { I18nService } from './i18n.service';

@ApiTags('i18n/tenant-languages')
@ApiBearerAuth()
@Controller('i18n/tenant-languages')
@UseGuards(JwtGuard, PermissionsGuard)
export class TenantLanguagesController {
  constructor(private readonly i18n: I18nService) {}

  @ApiOperation({ summary: 'List active languages for tenant' })
  @CheckAbility({ action: 'read', subject: 'TenantLanguage' })
  @Get()
  list() {
    return this.i18n.listTenantLanguages();
  }

  @ApiOperation({ summary: 'Add or update a tenant language (default / publish)' })
  @CheckAbility({ action: 'update', subject: 'TenantLanguage' })
  @Post()
  upsert(
    @Body(new ZodValidationPipe(UpsertTenantLanguageSchema))
    body: UpsertTenantLanguageInput,
  ) {
    return this.i18n.upsertTenantLanguage(body);
  }

  @ApiOperation({ summary: 'Remove a tenant language (non-default only)' })
  @CheckAbility({ action: 'update', subject: 'TenantLanguage' })
  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.i18n.deleteTenantLanguage(code.toLowerCase());
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UpdateLanguageSchema,
  UpsertLanguageSchema,
  type UpdateLanguageInput,
  type UpsertLanguageInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { I18nService } from './i18n.service';

/**
 * Admin languages (global catalog — landlord scope in practice).
 * OWNER/ADMIN roles already have 'manage' 'all' and can see these; we still
 * guard them with a Language subject for clarity.
 */
@ApiTags('i18n/languages')
@ApiBearerAuth()
@Controller('i18n/languages')
@UseGuards(JwtGuard, PermissionsGuard)
export class LanguagesController {
  constructor(private readonly i18n: I18nService) {}

  @ApiOperation({ summary: 'List global languages' })
  @CheckAbility({ action: 'read', subject: 'Language' })
  @Get()
  list() {
    return this.i18n.listLanguages();
  }

  @ApiOperation({ summary: 'Upsert a global language (admin/landlord)' })
  @CheckAbility({ action: 'create', subject: 'Language' })
  @Post()
  upsert(
    @Body(new ZodValidationPipe(UpsertLanguageSchema)) body: UpsertLanguageInput,
  ) {
    return this.i18n.upsertLanguage(body);
  }

  @ApiOperation({ summary: 'Update a global language' })
  @CheckAbility({ action: 'update', subject: 'Language' })
  @Patch(':code')
  update(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(UpdateLanguageSchema)) body: UpdateLanguageInput,
  ) {
    return this.i18n.updateLanguage(code.toLowerCase(), body);
  }
}

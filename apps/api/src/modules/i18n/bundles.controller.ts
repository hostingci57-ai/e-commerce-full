import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ListBundlesQuerySchema,
  UpdateUiBundleSchema,
  type ListBundlesQuery,
  type UpdateUiBundleInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { I18nService } from './i18n.service';

@ApiTags('i18n/bundles')
@ApiBearerAuth()
@Controller('i18n/bundles')
@UseGuards(JwtGuard, PermissionsGuard)
export class BundlesController {
  constructor(private readonly i18n: I18nService) {}

  @ApiOperation({ summary: 'List UI string bundles (admin)' })
  @CheckAbility({ action: 'read', subject: 'UiStringBundle' })
  @Get()
  list(
    @Query(new ZodValidationPipe(ListBundlesQuerySchema)) query: ListBundlesQuery,
  ) {
    return this.i18n.listBundles(query);
  }

  @ApiOperation({ summary: 'Update a UI string bundle (admin)' })
  @CheckAbility({ action: 'update', subject: 'UiStringBundle' })
  @Patch()
  update(
    @Body(new ZodValidationPipe(UpdateUiBundleSchema)) body: UpdateUiBundleInput,
  ) {
    return this.i18n.updateBundle(body);
  }
}

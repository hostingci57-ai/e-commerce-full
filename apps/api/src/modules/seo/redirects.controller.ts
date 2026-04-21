import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateRedirectSchema,
  ImportRedirectsSchema,
  ListRedirectsQuerySchema,
  UpdateRedirectSchema,
  type CreateRedirectInput,
  type ImportRedirectsInput,
  type ListRedirectsQuery,
  type UpdateRedirectInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { SeoService } from './seo.service';

@ApiTags('seo/redirects')
@ApiBearerAuth()
@Controller('seo/redirects')
@UseGuards(JwtGuard, PermissionsGuard)
export class RedirectsController {
  constructor(private readonly seo: SeoService) {}

  @ApiOperation({ summary: 'Create redirect (admin)' })
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'Redirect' })
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateRedirectSchema)) body: CreateRedirectInput,
  ) {
    return this.seo.createRedirect(body);
  }

  @ApiOperation({ summary: 'List redirects (admin)' })
  @CheckAbility({ action: 'read', subject: 'Redirect' })
  @Get()
  list(
    @Query(new ZodValidationPipe(ListRedirectsQuerySchema))
    query: ListRedirectsQuery,
  ) {
    return this.seo.listRedirects(query);
  }

  @ApiOperation({ summary: 'Import redirects from CSV (admin)' })
  @CheckAbility({ action: 'create', subject: 'Redirect' })
  @Post('import')
  importCsv(
    @Body(new ZodValidationPipe(ImportRedirectsSchema))
    body: ImportRedirectsInput,
  ) {
    return this.seo.importRedirects(body.csv, body.overwrite);
  }

  @ApiOperation({ summary: 'Update redirect (admin)' })
  @CheckAbility({ action: 'update', subject: 'Redirect' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateRedirectSchema)) body: UpdateRedirectInput,
  ) {
    return this.seo.updateRedirect(id, body);
  }

  @ApiOperation({ summary: 'Delete redirect (admin)' })
  @CheckAbility({ action: 'delete', subject: 'Redirect' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.seo.deleteRedirect(id);
  }
}

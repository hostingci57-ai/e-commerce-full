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
  CreateCmsPageSchema,
  ListCmsPagesQuerySchema,
  UpdateCmsPageSchema,
  type CreateCmsPageInput,
  type ListCmsPagesQuery,
  type UpdateCmsPageInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { CmsService } from './cms.service';

@ApiTags('cms/pages')
@ApiBearerAuth()
@Controller('cms/pages')
@UseGuards(JwtGuard, PermissionsGuard)
export class CmsPagesController {
  constructor(private readonly cms: CmsService) {}

  @ApiOperation({ summary: 'Create a CMS page (admin)' })
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'CmsPage' })
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateCmsPageSchema)) body: CreateCmsPageInput,
  ) {
    return this.cms.createPage(body);
  }

  @ApiOperation({ summary: 'List CMS pages (admin, includes drafts)' })
  @CheckAbility({ action: 'read', subject: 'CmsPage' })
  @Get()
  list(
    @Query(new ZodValidationPipe(ListCmsPagesQuerySchema))
    query: ListCmsPagesQuery,
  ) {
    return this.cms.listPages(query);
  }

  @ApiOperation({ summary: 'Get CMS page by id (admin)' })
  @CheckAbility({ action: 'read', subject: 'CmsPage' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cms.getPageById(id);
  }

  @ApiOperation({ summary: 'Update a CMS page (admin)' })
  @CheckAbility({ action: 'update', subject: 'CmsPage' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateCmsPageSchema)) body: UpdateCmsPageInput,
  ) {
    return this.cms.updatePage(id, body);
  }

  @ApiOperation({ summary: 'Delete a CMS page (admin)' })
  @CheckAbility({ action: 'delete', subject: 'CmsPage' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cms.deletePage(id);
  }

  @ApiOperation({ summary: 'Publish a CMS page (admin)' })
  @CheckAbility({ action: 'update', subject: 'CmsPage' })
  @Post(':id/publish')
  publish(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cms.setPublished(id, true);
  }

  @ApiOperation({ summary: 'Unpublish a CMS page (admin)' })
  @CheckAbility({ action: 'update', subject: 'CmsPage' })
  @Post(':id/unpublish')
  unpublish(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cms.setPublished(id, false);
  }
}

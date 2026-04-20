import { Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../../common/rbac/permissions.guard';
import { CheckAbility } from '../../../common/rbac/permissions.decorator';
import { TagsService } from './tags.service';

@ApiTags('catalog/tags')
@ApiBearerAuth()
@Controller('tags')
@UseGuards(JwtGuard, PermissionsGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @ApiOperation({ summary: 'List tags (501 — scheduled)' })
  @CheckAbility({ action: 'read', subject: 'Product' })
  @Get()
  list() {
    return this.tags.list();
  }

  @ApiOperation({ summary: 'Create tag (501 — scheduled)' })
  @CheckAbility({ action: 'create', subject: 'Product' })
  @Post()
  create() {
    return this.tags.create();
  }

  @ApiOperation({ summary: 'Get tag (501 — scheduled)' })
  @CheckAbility({ action: 'read', subject: 'Product' })
  @Get(':id')
  findOne(@Param('id') _id: string) {
    return this.tags.findById();
  }

  @ApiOperation({ summary: 'Update tag (501 — scheduled)' })
  @CheckAbility({ action: 'update', subject: 'Product' })
  @Patch(':id')
  update(@Param('id') _id: string) {
    return this.tags.update();
  }

  @ApiOperation({ summary: 'Delete tag (501 — scheduled)' })
  @CheckAbility({ action: 'delete', subject: 'Product' })
  @Delete(':id')
  remove(@Param('id') _id: string) {
    return this.tags.remove();
  }
}

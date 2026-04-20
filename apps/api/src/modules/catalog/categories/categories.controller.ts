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
  CreateCategorySchema,
  UpdateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../../common/rbac/permissions.guard';
import { CheckAbility } from '../../../common/rbac/permissions.decorator';
import { CategoriesService } from './categories.service';

@ApiTags('catalog/categories')
@ApiBearerAuth()
@Controller('categories')
@UseGuards(JwtGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @ApiOperation({ summary: 'Create category' })
  @CheckAbility({ action: 'create', subject: 'Category' })
  @Post()
  create(@Body(new ZodValidationPipe(CreateCategorySchema)) body: CreateCategoryInput) {
    return this.categories.create(body);
  }

  @ApiOperation({ summary: 'List categories (flat)' })
  @CheckAbility({ action: 'read', subject: 'Category' })
  @Get()
  list() {
    return this.categories.list();
  }

  @ApiOperation({ summary: 'Get category tree' })
  @CheckAbility({ action: 'read', subject: 'Category' })
  @Get('tree')
  tree() {
    return this.categories.tree();
  }

  @ApiOperation({ summary: 'Get category by id' })
  @CheckAbility({ action: 'read', subject: 'Category' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.findById(id);
  }

  @ApiOperation({ summary: 'Update category' })
  @CheckAbility({ action: 'update', subject: 'Category' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return this.categories.update(id, body);
  }

  @ApiOperation({ summary: 'Delete category' })
  @CheckAbility({ action: 'delete', subject: 'Category' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.remove(id);
  }
}

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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  BatchVariantsSchema,
  CreateProductSchema,
  ListProductsQuerySchema,
  TranslationsBatchSchema,
  UpdateProductSchema,
  type BatchVariantsInput,
  type CreateProductInput,
  type ListProductsQuery,
  type TranslationsBatchInput,
  type UpdateProductInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../../common/rbac/permissions.guard';
import { CheckAbility } from '../../../common/rbac/permissions.decorator';
import { ProductsService } from './products.service';

@ApiTags('catalog/products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @ApiOperation({ summary: 'Create a product' })
  @ApiResponse({ status: 201 })
  @CheckAbility({ action: 'create', subject: 'Product' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body(new ZodValidationPipe(CreateProductSchema)) body: CreateProductInput) {
    return this.products.create(body);
  }

  @ApiOperation({ summary: 'List products (cursor pagination)' })
  @CheckAbility({ action: 'read', subject: 'Product' })
  @Get()
  list(@Query(new ZodValidationPipe(ListProductsQuerySchema)) query: ListProductsQuery) {
    return this.products.list(query);
  }

  @ApiOperation({ summary: 'Get product by id' })
  @CheckAbility({ action: 'read', subject: 'Product' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.products.findById(id);
  }

  @ApiOperation({ summary: 'Update product (partial)' })
  @CheckAbility({ action: 'update', subject: 'Product' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) body: UpdateProductInput,
  ) {
    return this.products.update(id, body);
  }

  @ApiOperation({ summary: 'Soft delete product (archive)' })
  @CheckAbility({ action: 'delete', subject: 'Product' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.products.remove(id);
  }

  @ApiOperation({ summary: 'Batch create/update variants' })
  @CheckAbility({ action: 'update', subject: 'ProductVariant' })
  @Post(':id/variants')
  upsertVariants(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(BatchVariantsSchema)) body: BatchVariantsInput,
  ) {
    return this.products.upsertVariants(id, body);
  }

  @ApiOperation({ summary: 'Upsert product translations (i18n)' })
  @CheckAbility({ action: 'update', subject: 'Product' })
  @Patch(':id/translations')
  upsertTranslations(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(TranslationsBatchSchema)) body: TranslationsBatchInput,
  ) {
    return this.products.upsertTranslations(id, body);
  }
}

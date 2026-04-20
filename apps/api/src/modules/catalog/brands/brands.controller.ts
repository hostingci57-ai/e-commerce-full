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
  CreateBrandSchema,
  UpdateBrandSchema,
  type CreateBrandInput,
  type UpdateBrandInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../../common/rbac/permissions.guard';
import { CheckAbility } from '../../../common/rbac/permissions.decorator';
import { BrandsService } from './brands.service';

@ApiTags('catalog/brands')
@ApiBearerAuth()
@Controller('brands')
@UseGuards(JwtGuard, PermissionsGuard)
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @ApiOperation({ summary: 'Create brand' })
  @CheckAbility({ action: 'create', subject: 'Brand' })
  @Post()
  create(@Body(new ZodValidationPipe(CreateBrandSchema)) body: CreateBrandInput) {
    return this.brands.create(body);
  }

  @ApiOperation({ summary: 'List brands' })
  @CheckAbility({ action: 'read', subject: 'Brand' })
  @Get()
  list() {
    return this.brands.list();
  }

  @ApiOperation({ summary: 'Get brand by id' })
  @CheckAbility({ action: 'read', subject: 'Brand' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brands.findById(id);
  }

  @ApiOperation({ summary: 'Update brand' })
  @CheckAbility({ action: 'update', subject: 'Brand' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateBrandSchema)) body: UpdateBrandInput,
  ) {
    return this.brands.update(id, body);
  }

  @ApiOperation({ summary: 'Delete brand' })
  @CheckAbility({ action: 'delete', subject: 'Brand' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brands.remove(id);
  }
}

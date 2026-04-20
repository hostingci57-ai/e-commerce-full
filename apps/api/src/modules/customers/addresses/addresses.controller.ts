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
  CreateAddressSchema,
  UpdateAddressSchema,
  type CreateAddressInput,
  type UpdateAddressInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../../common/rbac/permissions.guard';
import { CheckAbility } from '../../../common/rbac/permissions.decorator';
import { AddressesService } from './addresses.service';

@ApiTags('customers/addresses')
@ApiBearerAuth()
@Controller('customers/me/addresses')
@UseGuards(JwtGuard, PermissionsGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @ApiOperation({ summary: 'List my addresses' })
  @CheckAbility({ action: 'read', subject: 'CustomerAddress' })
  @Get()
  list() {
    return this.addresses.list();
  }

  @ApiOperation({ summary: 'Create new address' })
  @CheckAbility({ action: 'create', subject: 'CustomerAddress' })
  @Post()
  create(@Body(new ZodValidationPipe(CreateAddressSchema)) body: CreateAddressInput) {
    return this.addresses.create(body);
  }

  @ApiOperation({ summary: 'Update address' })
  @CheckAbility({ action: 'update', subject: 'CustomerAddress' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateAddressSchema)) body: UpdateAddressInput,
  ) {
    return this.addresses.update(id, body);
  }

  @ApiOperation({ summary: 'Delete address' })
  @CheckAbility({ action: 'delete', subject: 'CustomerAddress' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.addresses.remove(id);
  }

  @ApiOperation({ summary: 'Mark address as default shipping/billing' })
  @CheckAbility({ action: 'update', subject: 'CustomerAddress' })
  @Post(':id/default')
  setDefault(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.addresses.setDefault(id);
  }
}

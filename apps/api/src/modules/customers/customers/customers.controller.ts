import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ListCustomersQuerySchema,
  UpdateCustomerSchema,
  type ListCustomersQuery,
  type UpdateCustomerInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../../common/rbac/permissions.guard';
import { CheckAbility } from '../../../common/rbac/permissions.decorator';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(JwtGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // --- Self-service (me) ------------------------------------------
  // NOTE: /me routes are declared BEFORE /:id to avoid UUID pipe swallowing "me".

  @ApiOperation({ summary: 'Get the authenticated customer profile' })
  @CheckAbility({ action: 'read', subject: 'Customer' })
  @Get('me')
  me() {
    return this.customers.me();
  }

  @ApiOperation({ summary: 'Update the authenticated customer profile' })
  @CheckAbility({ action: 'update', subject: 'Customer' })
  @Patch('me')
  updateMe(@Body(new ZodValidationPipe(UpdateCustomerSchema)) body: UpdateCustomerInput) {
    return this.customers.updateMe(body);
  }

  @ApiOperation({ summary: 'Request account deletion (KVKK right to be forgotten)' })
  @CheckAbility({ action: 'delete', subject: 'Customer' })
  @Delete('me')
  deleteMe() {
    return this.customers.deleteMeRequest();
  }

  // --- Admin-side -------------------------------------------------

  @ApiOperation({ summary: 'Admin list of tenant customers' })
  @CheckAbility({ action: 'read', subject: 'Customer' })
  @Get()
  list(@Query(new ZodValidationPipe(ListCustomersQuerySchema)) query: ListCustomersQuery) {
    return this.customers.list(query);
  }

  @ApiOperation({ summary: 'Admin view of a single customer' })
  @CheckAbility({ action: 'read', subject: 'Customer' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customers.findById(id);
  }

  @ApiOperation({ summary: 'Admin update of a customer' })
  @CheckAbility({ action: 'update', subject: 'Customer' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateCustomerSchema)) body: UpdateCustomerInput,
  ) {
    return this.customers.updateById(id, body);
  }
}

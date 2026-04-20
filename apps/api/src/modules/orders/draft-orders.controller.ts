import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ConvertDraftOrderSchema,
  CreateDraftOrderSchema,
  ListOrdersQuerySchema,
  UpdateDraftOrderSchema,
  type ConvertDraftOrderInput,
  type CreateDraftOrderInput,
  type ListOrdersQuery,
  type UpdateDraftOrderInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { DraftOrdersService } from './draft-orders.service';

/**
 * Admin-only draft order endpoints. Mounted at /v1/orders/draft so list /
 * detail don't clash with the main orders controller's `/v1/orders/:id`.
 */
@ApiTags('orders/draft')
@ApiBearerAuth()
@Controller('orders/draft')
@UseGuards(JwtGuard, PermissionsGuard)
export class DraftOrdersController {
  constructor(private readonly drafts: DraftOrdersService) {}

  @ApiOperation({ summary: 'List draft orders (admin)' })
  @CheckAbility({ action: 'read', subject: 'Order' })
  @Get()
  list(@Query(new ZodValidationPipe(ListOrdersQuerySchema)) q: ListOrdersQuery) {
    return this.drafts.list(q);
  }

  @ApiOperation({ summary: 'Create draft order (admin)' })
  @CheckAbility({ action: 'create', subject: 'Order' })
  @Post()
  create(@Body(new ZodValidationPipe(CreateDraftOrderSchema)) body: CreateDraftOrderInput) {
    return this.drafts.create(body);
  }

  @ApiOperation({ summary: 'Get draft order detail (admin)' })
  @CheckAbility({ action: 'read', subject: 'Order' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.drafts.findById(id);
  }

  @ApiOperation({ summary: 'Update draft order (admin)' })
  @CheckAbility({ action: 'update', subject: 'Order' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateDraftOrderSchema)) body: UpdateDraftOrderInput,
  ) {
    return this.drafts.update(id, body);
  }

  @ApiOperation({ summary: 'Convert draft to real order (admin)' })
  @CheckAbility({ action: 'update', subject: 'Order' })
  @Post(':id/convert')
  convert(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ConvertDraftOrderSchema)) body: ConvertDraftOrderInput,
  ) {
    return this.drafts.convert(id, body);
  }
}

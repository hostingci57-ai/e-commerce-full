import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApproveRefundSchema,
  ListRefundsQuerySchema,
  RejectRefundSchema,
  type ApproveRefundInput,
  type ListRefundsQuery,
  type RejectRefundInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { RefundsService } from './refunds.service';

/**
 * Admin-facing refund management. The customer-side create endpoint lives on
 * CustomerOrdersController (POST /v1/customers/me/orders/:id/refund-request)
 * where it already delegates to RefundsService.createRequest.
 */
@ApiTags('refunds')
@ApiBearerAuth()
@Controller('refund-requests')
@UseGuards(JwtGuard, PermissionsGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @ApiOperation({ summary: 'List refund requests (admin)' })
  @CheckAbility({ action: 'read', subject: 'Refund' })
  @Get()
  list(@Query(new ZodValidationPipe(ListRefundsQuerySchema)) q: ListRefundsQuery) {
    return this.refunds.list(q);
  }

  @ApiOperation({ summary: 'Get refund request by id (admin)' })
  @CheckAbility({ action: 'read', subject: 'Refund' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.refunds.findById(id);
  }

  @ApiOperation({ summary: 'Approve refund request (admin)' })
  @CheckAbility({ action: 'update', subject: 'Refund' })
  @Post(':id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ApproveRefundSchema)) body: ApproveRefundInput,
  ) {
    return this.refunds.approve(id, body);
  }

  @ApiOperation({ summary: 'Reject refund request (admin)' })
  @CheckAbility({ action: 'update', subject: 'Refund' })
  @Post(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(RejectRefundSchema)) body: RejectRefundInput,
  ) {
    return this.refunds.reject(id, body);
  }
}

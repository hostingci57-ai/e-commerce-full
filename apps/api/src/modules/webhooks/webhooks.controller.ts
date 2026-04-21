import {
  Body,
  Controller,
  Delete,
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
  CreateWebhookSubscriptionSchema,
  ListWebhookDeliveriesQuerySchema,
  UpdateWebhookSubscriptionSchema,
  type CreateWebhookSubscriptionInput,
  type ListWebhookDeliveriesQuery,
  type UpdateWebhookSubscriptionInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks/subscriptions')
@UseGuards(JwtGuard, PermissionsGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @ApiOperation({ summary: 'Create webhook subscription' })
  @CheckAbility({ action: 'manage', subject: 'Webhook' })
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateWebhookSubscriptionSchema))
    body: CreateWebhookSubscriptionInput,
  ) {
    return this.webhooks.create(body);
  }

  @ApiOperation({ summary: 'List subscriptions' })
  @CheckAbility({ action: 'read', subject: 'Webhook' })
  @Get()
  list() {
    return this.webhooks.list();
  }

  @ApiOperation({ summary: 'Get subscription' })
  @CheckAbility({ action: 'read', subject: 'Webhook' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.webhooks.findOne(id);
  }

  @ApiOperation({ summary: 'Update subscription' })
  @CheckAbility({ action: 'manage', subject: 'Webhook' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateWebhookSubscriptionSchema))
    body: UpdateWebhookSubscriptionInput,
  ) {
    return this.webhooks.update(id, body);
  }

  @ApiOperation({ summary: 'Delete subscription' })
  @CheckAbility({ action: 'manage', subject: 'Webhook' })
  @Delete(':id')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.webhooks.delete(id);
  }

  @ApiOperation({ summary: 'List deliveries for subscription' })
  @CheckAbility({ action: 'read', subject: 'Webhook' })
  @Get(':id/deliveries')
  deliveries(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(ListWebhookDeliveriesQuerySchema))
    q: ListWebhookDeliveriesQuery,
  ) {
    return this.webhooks.listDeliveries(id, q);
  }

  @ApiOperation({ summary: 'Retry a delivery' })
  @CheckAbility({ action: 'manage', subject: 'Webhook' })
  @Post(':id/retry/:deliveryId')
  retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
  ) {
    return this.webhooks.retryDelivery(id, deliveryId);
  }
}

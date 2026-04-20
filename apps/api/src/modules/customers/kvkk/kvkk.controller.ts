import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { KvkkConsentSchema, type KvkkConsentInput } from '@ecf/validation';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../../common/rbac/permissions.guard';
import { CheckAbility } from '../../../common/rbac/permissions.decorator';
import { KvkkService } from './kvkk.service';

@ApiTags('customers/kvkk')
@ApiBearerAuth()
@Controller('customers/me/kvkk')
@UseGuards(JwtGuard, PermissionsGuard)
export class KvkkController {
  constructor(private readonly kvkk: KvkkService) {}

  @ApiOperation({ summary: 'Record KVKK consent changes' })
  @CheckAbility({ action: 'create', subject: 'KvkkConsent' })
  @Post('consent')
  consent(
    @Body(new ZodValidationPipe(KvkkConsentSchema)) body: KvkkConsentInput,
    @Req() req: FastifyRequest,
  ) {
    return this.kvkk.recordConsent(body, {
      ip: req.ip,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    });
  }

  @ApiOperation({ summary: 'Export all customer data as JSON (right to portability)' })
  @CheckAbility({ action: 'read', subject: 'Customer' })
  @Get('export')
  exportMe() {
    return this.kvkk.exportMyData();
  }
}

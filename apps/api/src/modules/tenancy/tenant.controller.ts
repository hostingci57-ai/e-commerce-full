import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { TenantService } from './tenant.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { LandlordGuard } from '../auth/guards/landlord.guard';
import { SkipTenancy } from '../../common/tenancy/tenancy.decorators';

const CreateTenantSchema = z.object({
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,30}$/, 'Subdomain must be 3-30 chars [a-z0-9-]'),
  name: z.string().trim().min(2).max(120),
  planId: z.string().uuid(),
  ownerEmail: z.string().trim().toLowerCase().email().optional(),
  ownerPassword: z.string().min(8).max(128).optional(),
  ownerUserId: z.string().uuid().optional(),
});

const UpdateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  settings: z.record(z.unknown()).optional(),
});

const UpdatePlanSchema = z.object({ planId: z.string().uuid() });

const ListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['trial', 'active', 'suspended', 'cancelled', 'deleted']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

@ApiTags('landlord/tenants')
@ApiBearerAuth()
@Controller('landlord/tenants')
@UseGuards(JwtGuard, LandlordGuard)
@SkipTenancy()
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListQuerySchema)) query: z.infer<typeof ListQuerySchema>,
  ) {
    return this.tenants.list(query);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.tenants.findByIdWithStats(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateTenantSchema)) body: z.infer<typeof CreateTenantSchema>,
  ) {
    return this.tenants.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTenantSchema)) body: z.infer<typeof UpdateTenantSchema>,
  ) {
    return this.tenants.update(id, body);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string) {
    return this.tenants.setStatus(id, 'suspended');
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    return this.tenants.setStatus(id, 'active');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param('id') id: string) {
    return this.tenants.setStatus(id, 'deleted');
  }

  @Patch(':id/plan')
  async setPlan(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePlanSchema)) body: z.infer<typeof UpdatePlanSchema>,
  ) {
    return this.tenants.setPlan(id, body.planId);
  }
}

import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  ownerUserId: z.string().uuid().optional(),
});

const UpdatePlanSchema = z.object({ planId: z.string().uuid() });

const UpdateStatusSchema = z.object({
  status: z.enum(['trial', 'active', 'suspended', 'cancelled']),
});

@ApiTags('landlord/tenants')
@ApiBearerAuth()
@Controller('landlord/tenants')
@UseGuards(JwtGuard, LandlordGuard)
@SkipTenancy()
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  list() {
    return this.tenants.list();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.tenants.findById(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateTenantSchema)) body: z.infer<typeof CreateTenantSchema>) {
    return this.tenants.create(body);
  }

  @Patch(':id/plan')
  setPlan(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePlanSchema)) body: z.infer<typeof UpdatePlanSchema>,
  ) {
    return this.tenants.setPlan(id, body.planId);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateStatusSchema)) body: z.infer<typeof UpdateStatusSchema>,
  ) {
    return this.tenants.setStatus(id, body.status);
  }
}

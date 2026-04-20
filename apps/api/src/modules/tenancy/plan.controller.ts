import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { LandlordGuard } from '../auth/guards/landlord.guard';
import { SkipTenancy } from '../../common/tenancy/tenancy.decorators';
import { PlanService } from './plan.service';

@ApiTags('landlord/plans')
@ApiBearerAuth()
@Controller('landlord/plans')
@UseGuards(JwtGuard, LandlordGuard)
@SkipTenancy()
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  @Get()
  list() {
    return this.plans.list();
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Plan, PrismaClient } from '@ecf/db';
import { PRISMA_LANDLORD } from '../../common/prisma/prisma.module';

@Injectable()
export class PlanService {
  constructor(@Inject(PRISMA_LANDLORD) private readonly prisma: PrismaClient) {}

  async list(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ orderBy: { createdAt: 'asc' } });
  }
}

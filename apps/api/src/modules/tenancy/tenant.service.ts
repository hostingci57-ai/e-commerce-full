import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient, Tenant, TenantStatus } from '@ecf/db';
import { PRISMA_LANDLORD } from '../../common/prisma/prisma.module';

export interface CreateTenantInput {
  subdomain: string;
  name: string;
  planId: string;
  ownerUserId?: string | null;
}

@Injectable()
export class TenantService {
  constructor(@Inject(PRISMA_LANDLORD) private readonly prisma: PrismaClient) {}

  async list(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string): Promise<Tenant> {
    const t = await this.prisma.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException({ code: 'tenant_not_found', message: 'Tenant not found' });
    return t;
  }

  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { subdomain } });
  }

  async create(input: CreateTenantInput): Promise<Tenant> {
    return this.prisma.tenant.create({
      data: {
        subdomain: input.subdomain,
        name: input.name,
        planId: input.planId,
        ownerUserId: input.ownerUserId ?? null,
      },
    });
  }

  async setStatus(id: string, status: TenantStatus): Promise<Tenant> {
    return this.prisma.tenant.update({ where: { id }, data: { status } });
  }

  async setPlan(id: string, planId: string): Promise<Tenant> {
    return this.prisma.tenant.update({ where: { id }, data: { planId } });
  }
}

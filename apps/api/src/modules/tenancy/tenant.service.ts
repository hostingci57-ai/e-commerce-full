import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PrismaClient, Tenant, TenantStatus } from '@ecf/db';
import { PRISMA_LANDLORD } from '../../common/prisma/prisma.module';
import { PasswordService } from '../auth/password.service';

export interface CreateTenantInput {
  subdomain: string;
  name: string;
  planId: string;
  ownerEmail?: string;
  ownerPassword?: string;
  ownerUserId?: string | null;
}

export interface UpdateTenantInput {
  name?: string;
  settings?: Record<string, unknown>;
}

export interface ListTenantQuery {
  q?: string;
  status?: TenantStatus;
  page: number;
  pageSize: number;
}

export interface TenantStats {
  orderCount: number;
  customerCount: number;
  activeProductCount: number;
  memberCount: number;
}

@Injectable()
export class TenantService {
  constructor(
    @Inject(PRISMA_LANDLORD) private readonly prisma: PrismaClient,
    private readonly passwords: PasswordService,
  ) {}

  async list(query: ListTenantQuery): Promise<{
    items: Tenant[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: Prisma.TenantWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { subdomain: { contains: query.q.toLowerCase() } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { plan: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: string): Promise<Tenant> {
    const t = await this.prisma.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException({ code: 'tenant_not_found', message: 'Tenant not found' });
    return t;
  }

  async findByIdWithStats(
    id: string,
  ): Promise<Tenant & { plan: { id: string; code: string; name: string } | null; stats: TenantStats }> {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      include: { plan: { select: { id: true, code: true, name: true } } },
    });
    if (!t) throw new NotFoundException({ code: 'tenant_not_found', message: 'Tenant not found' });

    const [orderCount, customerCount, activeProductCount, memberCount] = await Promise.all([
      this.prisma.order.count({ where: { tenantId: id } }),
      this.prisma.customer.count({ where: { tenantId: id } }),
      this.prisma.product.count({ where: { tenantId: id, status: 'active' } }),
      this.prisma.tenantMember.count({ where: { tenantId: id } }),
    ]);
    return {
      ...t,
      stats: { orderCount, customerCount, activeProductCount, memberCount },
    };
  }

  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { subdomain } });
  }

  async create(input: CreateTenantInput): Promise<Tenant> {
    const plan = await this.prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan) {
      throw new BadRequestException({ code: 'plan_not_found', message: 'Plan not found' });
    }

    const existing = await this.prisma.tenant.findUnique({ where: { subdomain: input.subdomain } });
    if (existing) {
      throw new ConflictException({
        code: 'subdomain_taken',
        message: 'Subdomain already in use',
      });
    }

    // If owner credentials supplied, create a landlord-side User + OWNER TenantMember row.
    let ownerUserId: string | null = input.ownerUserId ?? null;

    if (!ownerUserId && input.ownerEmail && input.ownerPassword) {
      const passwordHash = await this.passwords.hash(input.ownerPassword);
      const existingUser = await this.prisma.user.findUnique({ where: { email: input.ownerEmail } });
      const user =
        existingUser ??
        (await this.prisma.user.create({
          data: { email: input.ownerEmail, passwordHash },
        }));
      ownerUserId = user.id;
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        subdomain: input.subdomain,
        name: input.name,
        planId: input.planId,
        ownerUserId,
        status: 'active',
      },
    });

    // Default tenant settings row — storefront + admin both assume it exists.
    // Landlord client bypasses RLS so a plain create is safe.
    await this.prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        storeName: input.name,
        storeEmail: input.ownerEmail ?? 'store@example.com',
      },
    });

    if (ownerUserId) {
      const ownerRole = await this.prisma.role.findFirst({
        where: { code: 'OWNER', tenantId: null },
      });
      if (ownerRole) {
        await this.prisma.tenantMember.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: ownerUserId } },
          create: {
            tenantId: tenant.id,
            userId: ownerUserId,
            roleId: ownerRole.id,
            acceptedAt: new Date(),
          },
          update: { acceptedAt: new Date() },
        });
      }
    }

    return tenant;
  }

  async update(id: string, input: UpdateTenantInput): Promise<Tenant> {
    await this.findById(id);
    const data: Prisma.TenantUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.settings !== undefined) data.settings = input.settings as Prisma.InputJsonValue;
    return this.prisma.tenant.update({ where: { id }, data });
  }

  async setStatus(id: string, status: TenantStatus): Promise<Tenant> {
    await this.findById(id);
    return this.prisma.tenant.update({ where: { id }, data: { status } });
  }

  async setPlan(id: string, planId: string): Promise<Tenant> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new BadRequestException({ code: 'plan_not_found', message: 'Plan not found' });
    }
    await this.findById(id);
    return this.prisma.tenant.update({ where: { id }, data: { planId } });
  }
}

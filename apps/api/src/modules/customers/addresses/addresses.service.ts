import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { withTenant } from '@ecf/db';
import type { CreateAddressInput, UpdateAddressInput } from '@ecf/validation';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class AddressesService {
  constructor(private readonly ctx: TenantContextService) {}

  private requireSelf(): { tenantId: string; customerId: string } {
    const rc = this.ctx.get();
    const tenantId = rc?.tenant?.tenantId;
    const customerId = rc?.customerId ?? null;
    if (!tenantId || !customerId) {
      throw new ForbiddenException({
        code: 'customer_auth_required',
        message: 'Customer authentication required',
      });
    }
    return { tenantId, customerId };
  }

  async list() {
    const { tenantId, customerId } = this.requireSelf();
    return withTenant({ tenantId }, (tx) =>
      tx.customerAddress.findMany({
        where: { customerId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  }

  async create(input: CreateAddressInput) {
    const { tenantId, customerId } = this.requireSelf();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      if (input.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.create({
        data: {
          tenantId,
          customerId,
          fullName: input.fullName,
          phone: input.phone ?? null,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          region: input.region ?? null,
          postalCode: input.postalCode,
          country: input.country,
          isDefault: input.isDefault ?? false,
        },
      });
    });
  }

  async update(id: string, input: UpdateAddressInput) {
    const { tenantId, customerId } = this.requireSelf();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.customerAddress.findUnique({ where: { id } });
      if (!existing || existing.customerId !== customerId) {
        throw new NotFoundException({ code: 'address_not_found', message: 'Address not found' });
      }
      if (input.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.update({
        where: { id },
        data: {
          fullName: input.fullName ?? undefined,
          phone: input.phone === undefined ? undefined : (input.phone ?? null),
          line1: input.line1 ?? undefined,
          line2: input.line2 === undefined ? undefined : (input.line2 ?? null),
          city: input.city ?? undefined,
          region: input.region === undefined ? undefined : (input.region ?? null),
          postalCode: input.postalCode ?? undefined,
          country: input.country ?? undefined,
          isDefault: input.isDefault === undefined ? undefined : input.isDefault,
        },
      });
    });
  }

  async remove(id: string) {
    const { tenantId, customerId } = this.requireSelf();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.customerAddress.findUnique({ where: { id } });
      if (!existing || existing.customerId !== customerId) {
        throw new NotFoundException({ code: 'address_not_found', message: 'Address not found' });
      }
      await tx.customerAddress.delete({ where: { id } });
      return { id, deleted: true };
    });
  }

  async setDefault(id: string) {
    const { tenantId, customerId } = this.requireSelf();
    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const existing = await tx.customerAddress.findUnique({ where: { id } });
      if (!existing || existing.customerId !== customerId) {
        throw new NotFoundException({ code: 'address_not_found', message: 'Address not found' });
      }
      await tx.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
      return tx.customerAddress.update({ where: { id }, data: { isDefault: true } });
    });
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, withTenant } from '@ecf/db';
import type { UpdateTenantSettingsInput } from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/**
 * Store-level preferences. Every tenant has a row here after onboarding;
 * `getOrCreate()` lazily inserts a sensible default when the row is absent
 * (covers tenants that existed before this module shipped).
 */
@Injectable()
export class TenantSettingsService {
  constructor(private readonly ctx: TenantContextService) {}

  private requireTenant(): string {
    const id = this.ctx.tenantId;
    if (!id) {
      throw new BadRequestException({
        code: 'tenant_required',
        message: 'Tenant context required',
      });
    }
    return id;
  }

  async getOrCreate(tenantId?: string) {
    const tid = tenantId ?? this.requireTenant();
    return withTenant({ tenantId: tid }, async (tx) => {
      let row = await tx.tenantSettings.findUnique({ where: { tenantId: tid } });
      if (!row) {
        // Pull the tenant name as the default store name.
        const tenant = await tx.$queryRawUnsafe<{ name: string }[]>(
          `SELECT name FROM tenants WHERE id = $1::uuid LIMIT 1`,
          tid,
        );
        row = await tx.tenantSettings.create({
          data: {
            tenantId: tid,
            storeName: tenant?.[0]?.name ?? 'My Store',
            storeEmail: 'store@example.com',
          },
        });
      }
      return this.serialize(row);
    });
  }

  async update(input: UpdateTenantSettingsInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      // Ensure the row exists so update won't 404.
      let existing = await tx.tenantSettings.findUnique({ where: { tenantId } });
      if (!existing) {
        existing = await tx.tenantSettings.create({
          data: {
            tenantId,
            storeName: input.storeName ?? 'My Store',
            storeEmail: input.storeEmail ?? 'store@example.com',
          },
        });
      }
      const data: Prisma.TenantSettingsUpdateInput = {};
      if (input.storeName !== undefined) data.storeName = input.storeName;
      if (input.storeEmail !== undefined) data.storeEmail = input.storeEmail;
      if (input.storePhone !== undefined) data.storePhone = input.storePhone;
      if (input.storeAddress !== undefined)
        data.storeAddress = (input.storeAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue;
      if (input.currency !== undefined) data.currency = input.currency;
      if (input.defaultLanguage !== undefined) data.defaultLanguage = input.defaultLanguage;
      if (input.timezone !== undefined) data.timezone = input.timezone;
      if (input.weightUnit !== undefined) data.weightUnit = input.weightUnit;
      if (input.dimensionUnit !== undefined) data.dimensionUnit = input.dimensionUnit;
      if (input.kvkkContact !== undefined) data.kvkkContact = input.kvkkContact;
      if (input.taxNumber !== undefined) data.taxNumber = input.taxNumber;
      if (input.legalName !== undefined) data.legalName = input.legalName;
      if (input.logoMediaId !== undefined) data.logoMediaId = input.logoMediaId;
      if (input.faviconMediaId !== undefined) data.faviconMediaId = input.faviconMediaId;
      if (input.primaryColor !== undefined) data.primaryColor = input.primaryColor;

      const updated = await tx.tenantSettings.update({
        where: { tenantId },
        data,
      });
      return this.serialize(updated);
    });
  }

  /**
   * Public subset (storefront) — only fields safe to expose to unauthenticated
   * consumers. Cached 5 minutes at the edge.
   */
  async getPublic(tenantId?: string) {
    const row = await this.getOrCreate(tenantId);
    return {
      storeName: row.storeName,
      storeEmail: row.storeEmail,
      storePhone: row.storePhone,
      currency: row.currency,
      defaultLanguage: row.defaultLanguage,
      timezone: row.timezone,
      logoMediaId: row.logoMediaId,
      faviconMediaId: row.faviconMediaId,
      primaryColor: row.primaryColor,
      kvkkContact: row.kvkkContact,
      legalName: row.legalName,
      storeAddress: row.storeAddress,
    };
  }

  private serialize(row: {
    tenantId: string;
    storeName: string;
    storeEmail: string;
    storePhone: string | null;
    storeAddress: Prisma.JsonValue | null;
    currency: string;
    defaultLanguage: string;
    timezone: string;
    weightUnit: string;
    dimensionUnit: string;
    kvkkContact: string | null;
    taxNumber: string | null;
    legalName: string | null;
    logoMediaId: string | null;
    faviconMediaId: string | null;
    primaryColor: string | null;
    updatedAt: Date;
  }) {
    return {
      tenantId: row.tenantId,
      storeName: row.storeName,
      storeEmail: row.storeEmail,
      storePhone: row.storePhone,
      storeAddress: row.storeAddress,
      currency: row.currency,
      defaultLanguage: row.defaultLanguage,
      timezone: row.timezone,
      weightUnit: row.weightUnit,
      dimensionUnit: row.dimensionUnit,
      kvkkContact: row.kvkkContact,
      taxNumber: row.taxNumber,
      legalName: row.legalName,
      logoMediaId: row.logoMediaId,
      faviconMediaId: row.faviconMediaId,
      primaryColor: row.primaryColor,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

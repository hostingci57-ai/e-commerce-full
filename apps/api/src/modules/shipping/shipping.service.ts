import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, ShipmentStatus } from '@ecf/db';
import { withTenant } from '@ecf/db';
import type {
  CreateProviderShipmentInput,
  ShippingMethodConfigInput,
  UpdateShippingMethodConfigInput,
} from '@ecf/validation';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { ShippingRegistryService } from '../../common/shipping/shipping-registry.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import type { ShippingAddressLike } from '../../common/shipping/shipping-provider.interface';

@Injectable()
export class ShippingService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly registry: ShippingRegistryService,
    private readonly outbox: OutboxService,
  ) {}

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

  // -------------------- Admin CRUD ----------------------------------------

  async listConfigs() {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.shippingMethodConfig.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      });
      return rows.map((row) => this.serializeConfig(row));
    });
  }

  async upsertConfig(input: ShippingMethodConfigInput) {
    const tenantId = this.requireTenant();
    this.registry.require(input.providerCode);
    return withTenant({ tenantId }, async (tx) => {
      const existing = await tx.shippingMethodConfig.findUnique({
        where: {
          tenantId_providerCode_code: {
            tenantId,
            providerCode: input.providerCode,
            code: input.code,
          },
        },
      });
      const data = {
        displayName: input.displayName,
        description: input.description ?? null,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        estimatedDaysMin: input.estimatedDaysMin ?? null,
        estimatedDaysMax: input.estimatedDaysMax ?? null,
        freeShippingThreshold: input.freeShippingThreshold ?? null,
      };
      const row = existing
        ? await tx.shippingMethodConfig.update({
            where: {
              tenantId_providerCode_code: {
                tenantId,
                providerCode: input.providerCode,
                code: input.code,
              },
            },
            data,
          })
        : await tx.shippingMethodConfig.create({
            data: {
              tenantId,
              providerCode: input.providerCode,
              code: input.code,
              ...data,
            },
          });
      return this.serializeConfig(row);
    });
  }

  async updateConfig(id: string, input: UpdateShippingMethodConfigInput) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const existing = await tx.shippingMethodConfig.findUnique({
        where: { tenantId_id: { tenantId, id } },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'shipping_method_not_found',
          message: 'Shipping method config not found',
        });
      }
      const data: Prisma.ShippingMethodConfigUpdateInput = {};
      if (input.displayName !== undefined) data.displayName = input.displayName;
      if (input.description !== undefined) data.description = input.description;
      if (input.config !== undefined) data.config = input.config as Prisma.InputJsonValue;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
      if (input.estimatedDaysMin !== undefined) data.estimatedDaysMin = input.estimatedDaysMin;
      if (input.estimatedDaysMax !== undefined) data.estimatedDaysMax = input.estimatedDaysMax;
      if (input.freeShippingThreshold !== undefined)
        data.freeShippingThreshold = input.freeShippingThreshold;
      const updated = await tx.shippingMethodConfig.update({
        where: { tenantId_id: { tenantId, id } },
        data,
      });
      return this.serializeConfig(updated);
    });
  }

  async deleteConfig(id: string) {
    const tenantId = this.requireTenant();
    await withTenant({ tenantId }, async (tx) => {
      await tx.shippingMethodConfig.delete({
        where: { tenantId_id: { tenantId, id } },
      });
    });
    return { ok: true };
  }

  // -------------------- Rate lookup ---------------------------------------

  async getRatesForAddress(input: {
    destinationAddress: ShippingAddressLike;
    subtotalMinor: bigint;
    currency: string;
  }) {
    const tenantId = this.requireTenant();
    const rates = await this.registry.listAvailable({
      tenantId,
      destinationAddress: input.destinationAddress,
      subtotalMinor: input.subtotalMinor,
      currency: input.currency,
      packages: [],
    });
    return rates.map((r) => ({
      providerCode: r.providerCode,
      code: r.code,
      name: r.name,
      priceMinor: r.priceMinor.toString(),
      currency: r.currency,
      estimatedDays: r.estimatedDays ?? null,
      description: r.description ?? null,
      freeShippingApplied: r.freeShippingApplied ?? false,
    }));
  }

  // -------------------- Shipments -----------------------------------------

  async createShipment(orderId: string, input: CreateProviderShipmentInput) {
    const tenantId = this.requireTenant();
    const provider = this.registry.require(input.providerCode);

    return withTenant({ tenantId, userId: this.ctx.userId }, async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, tenantId: true },
      });
      if (!order) {
        throw new NotFoundException({
          code: 'order_not_found',
          message: 'Order not found',
        });
      }

      const result = await provider.createShipment?.({
        tenantId,
        orderId,
        trackingNumber: input.trackingNumber ?? null,
      });

      const shipment = await tx.shipment.create({
        data: {
          tenantId,
          orderId,
          providerCode: input.providerCode,
          trackingNumber: input.trackingNumber ?? result?.trackingNumber ?? null,
          trackingUrl: input.trackingUrl ?? result?.trackingUrl ?? null,
          status: ((result?.status ?? 'PENDING') as ShipmentStatus),
          shippedAt: result?.status === 'SHIPPED' ? new Date() : null,
        },
      });

      await this.outbox.publish(tx, {
        tenantId,
        aggregateType: 'Shipment',
        aggregateId: shipment.id,
        eventType: 'shipment.created',
        payload: {
          shipmentId: shipment.id,
          orderId,
          providerCode: shipment.providerCode,
          trackingNumber: shipment.trackingNumber,
          status: shipment.status,
        } as Prisma.InputJsonValue,
      });

      return this.serializeShipment(shipment);
    });
  }

  async listShipmentsForOrder(orderId: string) {
    const tenantId = this.requireTenant();
    return withTenant({ tenantId }, async (tx) => {
      const rows = await tx.shipment.findMany({
        where: { tenantId, orderId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => this.serializeShipment(row));
    });
  }

  // -------------------- Helpers -------------------------------------------

  private serializeConfig(row: {
    id: string;
    providerCode: string;
    code: string;
    displayName: string;
    description: string | null;
    config: Prisma.JsonValue;
    isActive: boolean;
    sortOrder: number;
    estimatedDaysMin: number | null;
    estimatedDaysMax: number | null;
    freeShippingThreshold: bigint | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      providerCode: row.providerCode,
      code: row.code,
      displayName: row.displayName,
      description: row.description,
      config: row.config,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      estimatedDaysMin: row.estimatedDaysMin,
      estimatedDaysMax: row.estimatedDaysMax,
      freeShippingThreshold:
        row.freeShippingThreshold !== null ? row.freeShippingThreshold.toString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private serializeShipment(row: {
    id: string;
    orderId: string;
    providerCode: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: ShipmentStatus;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      orderId: row.orderId,
      providerCode: row.providerCode,
      trackingNumber: row.trackingNumber,
      trackingUrl: row.trackingUrl,
      status: row.status,
      shippedAt: row.shippedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

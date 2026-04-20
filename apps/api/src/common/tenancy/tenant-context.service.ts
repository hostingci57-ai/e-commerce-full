import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { TenantContextShape, RequestContextShape } from '@ecf/types';

const KEY = 'ecf.requestContext';

/**
 * Thin wrapper around nestjs-cls storing per-request tenant + user + audience.
 * Set by TenantResolverMiddleware (tenant) and JwtGuard (user/audience).
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  init(partial: Partial<RequestContextShape> = {}): void {
    const existing = this.cls.get<RequestContextShape>(KEY);
    const merged: RequestContextShape = {
      requestId: existing?.requestId ?? this.cls.getId() ?? 'unknown',
      tenant: existing?.tenant ?? null,
      userId: existing?.userId ?? null,
      customerId: existing?.customerId ?? null,
      audience: existing?.audience ?? null,
      isLandlord: existing?.isLandlord ?? false,
      ...partial,
    };
    this.cls.set(KEY, merged);
  }

  get(): RequestContextShape | undefined {
    return this.cls.get<RequestContextShape>(KEY);
  }

  setTenant(tenant: TenantContextShape | null): void {
    this.init({ tenant });
  }

  setUser(opts: {
    userId: string | null;
    customerId: string | null;
    audience: 'customer' | 'staff' | 'landlord';
    isLandlord: boolean;
  }): void {
    this.init(opts);
  }

  get tenantId(): string | null {
    return this.get()?.tenant?.tenantId ?? null;
  }

  get userId(): string | null {
    return this.get()?.userId ?? null;
  }

  get isLandlord(): boolean {
    return this.get()?.isLandlord ?? false;
  }

  get requestId(): string {
    return this.get()?.requestId ?? 'unknown';
  }
}

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled' | 'deleted';

export interface TenantContextShape {
  tenantId: string;
  subdomain: string;
  status: TenantStatus;
}

export interface RequestContextShape {
  requestId: string;
  tenant?: TenantContextShape | null;
  userId?: string | null;
  customerId?: string | null;
  audience?: 'customer' | 'staff' | 'landlord' | null;
  roles?: import('./auth').RoleCode[];
  jti?: string | null;
  isLandlord: boolean;
}

/**
 * JWT audience — distinguishes three authentication scopes.
 * - customer: storefront shopper (no tenant-member row required)
 * - staff:    tenant-admin user (TenantMember row required)
 * - landlord: platform operator (bypasses RLS, separate path)
 */
export type JwtAudience = 'customer' | 'staff' | 'landlord';

export type RoleCode =
  | 'OWNER'
  | 'ADMIN'
  | 'PRODUCT_MANAGER'
  | 'ORDER_OPERATOR'
  | 'VIEWER'
  | 'CUSTOMER';

/** Payload we sign into access JWTs (RS256, jose). */
export interface JwtPayload {
  /** User id (uuid v7 for tenant users, v4 for landlord) */
  sub: string;
  /** Audience — customer | staff | landlord */
  aud: JwtAudience;
  /** Token issuer, matches JWT_ISSUER env */
  iss: string;
  /** Unix seconds */
  exp: number;
  /** Unix seconds */
  iat: number;
  /** JTI — random unique id for this token */
  jti: string;
  /** Tenant id — present for staff (always), customer (when scoped), absent for landlord */
  tenantId?: string;
  /** Role codes — only for staff and landlord */
  roles?: RoleCode[];
  /** Customer row id — for customer scope (to scope orders/addresses) */
  customerId?: string;
  /** Email address at time of issuance */
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  aud: JwtAudience;
  iss: string;
  exp: number;
  iat: number;
  jti: string;
  tenantId?: string;
  /** Marks this as a refresh, not access. */
  typ: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  audience: JwtAudience;
  tenantId: string | null;
  customerId: string | null;
  roles: RoleCode[];
  jti: string;
}

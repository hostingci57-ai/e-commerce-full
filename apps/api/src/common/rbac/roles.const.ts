import type { RoleCode } from '@ecf/types';

/** Canonical role codes. Match packages/types/src/auth.ts RoleCode union. */
export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  PRODUCT_MANAGER: 'PRODUCT_MANAGER',
  ORDER_OPERATOR: 'ORDER_OPERATOR',
  VIEWER: 'VIEWER',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type AnyRoleCode = RoleCode;

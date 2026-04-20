/**
 * Shared seed data: subscription plans + canonical system roles.
 *
 * The schema's RoleCode union currently enumerates six codes
 * (OWNER, ADMIN, PRODUCT_MANAGER, ORDER_OPERATOR, VIEWER, CUSTOMER).
 * The FSD Faz 6c brief also lists MARKETING and ACCOUNTANT as system roles.
 * These extra codes are seeded into the `roles` table so tenant owners can
 * already assign them; the RoleCode type will be widened in a follow-up.
 */

export type PlanSpec = {
  code: 'starter' | 'growth' | 'enterprise';
  name: string;
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
};

export const PLANS: PlanSpec[] = [
  {
    code: 'starter',
    name: 'Starter',
    features: {
      currency: 'TRY',
      pricePerMonth: 299,
      support: 'email',
      customDomain: false,
      analytics: 'basic',
    },
    limits: {
      maxProducts: 500,
      maxOrdersPerMonth: 1000,
      maxStaff: 2,
      maxStorageMb: 1024,
    },
  },
  {
    code: 'growth',
    name: 'Growth',
    features: {
      currency: 'TRY',
      pricePerMonth: 799,
      support: 'priority-email',
      customDomain: true,
      analytics: 'advanced',
      abandonedCart: true,
    },
    limits: {
      maxProducts: 5000,
      maxOrdersPerMonth: 10000,
      maxStaff: 10,
      maxStorageMb: 10240,
    },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    features: {
      currency: 'TRY',
      pricePerMonth: 2999,
      support: 'dedicated',
      customDomain: true,
      analytics: 'advanced',
      sla: '99.9',
      sso: true,
    },
    limits: {
      maxProducts: null,
      maxOrdersPerMonth: null,
      maxStaff: null,
      maxStorageMb: null,
    },
  },
];

export type RoleSpec = {
  code: string;
  name: string;
  permissions: string[];
};

/**
 * System roles (tenantId = NULL). Permissions are CASL-style ability verbs
 * that the AbilityFactory consumes when building a per-request Ability.
 * The AbilityFactory today reads role codes directly; the `permissions`
 * JSON is documentary but will drive per-role overrides once custom
 * tenant roles land (FSD Faz 7).
 */
export const SYSTEM_ROLES: RoleSpec[] = [
  {
    code: 'OWNER',
    name: 'Owner',
    permissions: ['*'],
  },
  {
    code: 'ADMIN',
    name: 'Admin',
    permissions: [
      'manage:catalog',
      'manage:order',
      'manage:customer',
      'manage:staff',
      'manage:settings',
      'manage:coupon',
      'manage:refund',
      'view:report',
    ],
  },
  {
    code: 'PRODUCT_MANAGER',
    name: 'Product Manager',
    permissions: [
      'manage:product',
      'manage:variant',
      'manage:category',
      'manage:brand',
      'manage:media',
      'view:order',
    ],
  },
  {
    code: 'ORDER_OPERATOR',
    name: 'Order Operator',
    permissions: [
      'view:order',
      'update:order.status',
      'manage:refund',
      'view:customer',
      'view:product',
    ],
  },
  {
    code: 'MARKETING',
    name: 'Marketing',
    permissions: [
      'manage:coupon',
      'manage:campaign',
      'view:customer',
      'view:order',
      'view:report',
    ],
  },
  {
    code: 'ACCOUNTANT',
    name: 'Accountant',
    permissions: [
      'view:order',
      'view:refund',
      'view:report.financial',
      'export:report',
    ],
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    permissions: ['view:product', 'view:order', 'view:customer', 'view:report'],
  },
  {
    code: 'CUSTOMER',
    name: 'Customer',
    permissions: ['view:product', 'manage:self.cart', 'manage:self.order', 'manage:self.address'],
  },
];

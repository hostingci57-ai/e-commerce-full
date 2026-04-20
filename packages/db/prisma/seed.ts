/**
 * Prisma seed — idempotent.
 *
 * Seeds:
 *   - Plans: Starter (TRY 299/ay), Growth (TRY 799/ay), Enterprise (custom)
 *   - Roles:  OWNER, ADMIN, PRODUCT_MANAGER, ORDER_OPERATOR, VIEWER, CUSTOMER
 *
 * Run with: `pnpm --filter @ecf/db run seed`
 */
import { prismaLandlord } from '../src/client';

type PlanSeed = {
  code: 'starter' | 'growth' | 'enterprise';
  name: string;
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
};

const PLANS: PlanSeed[] = [
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
      maxOrdersPerMonth: 500,
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
      maxOrdersPerMonth: 5000,
      maxStaff: 10,
      maxStorageMb: 10240,
    },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    features: {
      currency: 'TRY',
      pricePerMonth: null, // on request
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

const ROLES: Array<{ code: string; name: string }> = [
  { code: 'OWNER', name: 'Owner' },
  { code: 'ADMIN', name: 'Admin' },
  { code: 'PRODUCT_MANAGER', name: 'Product Manager' },
  { code: 'ORDER_OPERATOR', name: 'Order Operator' },
  { code: 'VIEWER', name: 'Viewer' },
  { code: 'CUSTOMER', name: 'Customer' },
];

async function seedPlans(): Promise<void> {
  for (const plan of PLANS) {
    await prismaLandlord.plan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, features: plan.features, limits: plan.limits },
      create: {
        code: plan.code,
        name: plan.name,
        features: plan.features,
        limits: plan.limits,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`[seed] plan ${plan.code} ok`);
  }
}

async function seedRoles(): Promise<void> {
  for (const role of ROLES) {
    const existing = await prismaLandlord.role.findFirst({
      where: { code: role.code, tenantId: null },
    });
    if (existing) {
      await prismaLandlord.role.update({
        where: { id: existing.id },
        data: { name: role.name },
      });
    } else {
      await prismaLandlord.role.create({
        data: { code: role.code, name: role.name, tenantId: null },
      });
    }
    // eslint-disable-next-line no-console
    console.log(`[seed] role ${role.code} ok`);
  }
}

async function main(): Promise<void> {
  await seedPlans();
  await seedRoles();
}

main()
  .then(() => prismaLandlord.$disconnect())
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed', err);
    return prismaLandlord.$disconnect().finally(() => process.exit(1));
  });

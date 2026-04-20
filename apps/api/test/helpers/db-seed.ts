import { randomUUID } from 'node:crypto';
import { prismaLandlord as prisma } from '@ecf/db';

/**
 * Seed factories for e2e tests. Uses the BYPASSRLS landlord Prisma client so
 * cross-tenant setup works without first establishing a tenant session.
 *
 * These are intentionally small, cheap inserts that return the Prisma rows. A
 * test that needs specific field overrides should pass them via `overrides`.
 */

export interface SeededPlan {
  id: string;
  code: string;
}

export async function ensureBasicPlan(): Promise<SeededPlan> {
  const code = 'basic';
  const existing = await prisma.plan.findUnique({ where: { code } });
  if (existing) return { id: existing.id, code: existing.code };
  const created = await prisma.plan.create({
    data: { id: randomUUID(), code, name: 'Basic (test)', features: {}, limits: {} },
  });
  return { id: created.id, code: created.code };
}

export interface SeededTenant {
  id: string;
  subdomain: string;
  name: string;
  planId: string;
}

export async function createTenant(
  overrides: Partial<{ subdomain: string; name: string; planId: string }> = {},
): Promise<SeededTenant> {
  const plan = overrides.planId ? { id: overrides.planId } : await ensureBasicPlan();
  const subdomain = overrides.subdomain ?? `t-${randomUUID().slice(0, 8)}`;
  const row = await prisma.tenant.create({
    data: {
      id: randomUUID(),
      subdomain,
      name: overrides.name ?? subdomain,
      planId: plan.id,
      status: 'active',
    },
  });
  return { id: row.id, subdomain: row.subdomain, name: row.name, planId: row.planId };
}

export interface SeededUser {
  id: string;
  email: string;
}

export async function createUser(overrides: Partial<{ email: string; passwordHash: string }> = {}): Promise<SeededUser> {
  const email = overrides.email ?? `u-${randomUUID().slice(0, 8)}@test.local`;
  const row = await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      // Stored hash placeholder — we mint JWTs directly so login is not needed.
      passwordHash: overrides.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$aaaa$bbbb',
    },
  });
  return { id: row.id, email: row.email };
}

export interface SeededCustomer {
  id: string;
  userId: string;
  email: string;
  tenantId: string;
}

export async function createCustomer(
  tenantId: string,
  overrides: Partial<{ email: string; userId: string }> = {},
): Promise<SeededCustomer> {
  const user = overrides.userId
    ? { id: overrides.userId }
    : await createUser({ email: overrides.email });
  const email = overrides.email ?? `c-${randomUUID().slice(0, 8)}@test.local`;
  const row = await prisma.customer.create({
    data: {
      id: randomUUID(),
      tenantId,
      userId: user.id,
      email,
    },
  });
  return { id: row.id, userId: user.id, email: row.email, tenantId };
}

export interface SeededProduct {
  productId: string;
  variantId: string;
  sku: string;
  priceMinorUnits: bigint;
}

export async function createProduct(
  tenantId: string,
  overrides: Partial<{
    slug: string;
    title: string;
    priceMinorUnits: bigint;
    stockOnHand: number;
    sku: string;
  }> = {},
): Promise<SeededProduct> {
  const slug = overrides.slug ?? `p-${randomUUID().slice(0, 8)}`;
  const sku = overrides.sku ?? `SKU-${randomUUID().slice(0, 8)}`;
  const price = overrides.priceMinorUnits ?? 1000n;
  const stock = overrides.stockOnHand ?? 100;

  const productId = randomUUID();
  const variantId = randomUUID();
  await prisma.product.create({
    data: {
      id: productId,
      tenantId,
      slug,
      title: overrides.title ?? slug,
      status: 'active',
      variants: {
        create: {
          id: variantId,
          tenantId,
          sku,
          priceMinorUnits: price,
          currency: 'TRY',
          stockOnHand: stock,
        },
      },
    },
  });
  return { productId, variantId, sku, priceMinorUnits: price };
}

/**
 * Seed helpers: clear all rows from a tenant. Useful between tests to keep
 * noise out without nuking the whole DB. Order matters — FKs first.
 */
export async function truncateTenant(tenantId: string): Promise<void> {
  await prisma.orderStatusHistory.deleteMany({ where: { tenantId } });
  await prisma.orderLine.deleteMany({ where: { tenantId } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.inventoryReservation.deleteMany({ where: { tenantId } });
  await prisma.customerAddress.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.categoryProduct.deleteMany({ where: { tenantId } });
  await prisma.productVariant.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });
  await prisma.brand.deleteMany({ where: { tenantId } });
  await prisma.outboxEvent.deleteMany({ where: { tenantId } });
  await prisma.tenantMember.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {
    /* tenant may already be gone */
  });
}

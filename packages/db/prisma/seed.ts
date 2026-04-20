/**
 * Prisma seed — idempotent.
 *
 * Landlord side (BYPASSRLS via prismaLandlord):
 *   - Plans: starter / growth / enterprise
 *   - System roles (tenantId = NULL): OWNER, ADMIN, PRODUCT_MANAGER,
 *     ORDER_OPERATOR, MARKETING, ACCOUNTANT, VIEWER, CUSTOMER
 *   - Landlord super admin user (admin@platform.local)
 *
 * Tenant side — demo tenants with realistic data:
 *   - "Kahve Dünyası"  (Growth plan): 3 brands, 7 categories, 20 products,
 *                      10 customers, 15 orders, 3 coupons
 *   - "Moda Butik"     (Starter plan): 1 brand, apparel tree, 15 products,
 *                       5 customers, 5 orders, 1 coupon
 *
 * Passwords are read from env with dev-safe fallbacks:
 *   SEED_LANDLORD_PASSWORD  (default: admin123)
 *   SEED_TENANT_OWNER_PASSWORD (default: owner123)
 *
 * Re-running is safe: every write uses upsert / existence-checked create, and
 * deterministic identifiers (subdomain, slug, orderNumber, email) ensure the
 * same seed produces the same dataset.
 *
 * Run with:  pnpm --filter @ecf/db run seed
 */

/* eslint-disable no-console */
import { hash, Algorithm } from '@node-rs/argon2';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prismaLandlord } from '../src/client';
import { withTenant } from '../src/tenancy';
import { PLANS, SYSTEM_ROLES } from './seed-data/shared';
import { kahveDunyasiSpec } from './seed-data/kahve-dunyasi';
import { modaButikSpec } from './seed-data/moda-butik';
import type {
  CouponSeed,
  CustomerSeed,
  DemoTenantSpec,
  OrderSeed,
  ProductSeed,
} from './seed-data/types';

const CURRENCY = 'TRY';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const ARGON_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON_OPTS);
}

function envPassword(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

type LocalTx = Omit<
  PrismaClient,
  '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
>;

/* -------------------------------------------------------------------------- */
/* Plans                                                                       */
/* -------------------------------------------------------------------------- */

async function seedPlans(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const plan of PLANS) {
    const row = await prismaLandlord.plan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, features: plan.features as Prisma.InputJsonValue, limits: plan.limits as Prisma.InputJsonValue },
      create: {
        code: plan.code,
        name: plan.name,
        features: plan.features as Prisma.InputJsonValue,
        limits: plan.limits as Prisma.InputJsonValue,
      },
    });
    out[plan.code] = row.id;
    console.log(`[seed] plan ${plan.code} → ${row.id}`);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* System roles (tenantId NULL)                                                */
/* -------------------------------------------------------------------------- */

async function seedSystemRoles(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const role of SYSTEM_ROLES) {
    const existing = await prismaLandlord.role.findFirst({
      where: { code: role.code, tenantId: null },
    });
    if (existing) {
      const updated = await prismaLandlord.role.update({
        where: { id: existing.id },
        data: { name: role.name, permissions: role.permissions as Prisma.InputJsonValue },
      });
      out[role.code] = updated.id;
    } else {
      const created = await prismaLandlord.role.create({
        data: {
          code: role.code,
          name: role.name,
          tenantId: null,
          permissions: role.permissions as Prisma.InputJsonValue,
        },
      });
      out[role.code] = created.id;
    }
    console.log(`[seed] role ${role.code} ok`);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Landlord super admin                                                        */
/* -------------------------------------------------------------------------- */

async function seedLandlordSuperAdmin(): Promise<void> {
  const email = 'admin@platform.local';
  const password = envPassword('SEED_LANDLORD_PASSWORD', 'admin123');
  const passwordHash = await hashPassword(password);

  await prismaLandlord.landlordUser.upsert({
    where: { email },
    update: { passwordHash, name: 'Platform Super Admin' },
    create: { email, passwordHash, name: 'Platform Super Admin' },
  });
  console.log(`[seed] landlord super admin ${email} ok`);
}

/* -------------------------------------------------------------------------- */
/* Tenant user (reused for owner + staff)                                      */
/* -------------------------------------------------------------------------- */

async function upsertTenantUser(params: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}): Promise<string> {
  const row = await prismaLandlord.user.upsert({
    where: { email: params.email },
    update: {
      passwordHash: params.passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
    },
    create: {
      email: params.email,
      passwordHash: params.passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      emailVerifiedAt: new Date(),
    },
  });
  return row.id;
}

/* -------------------------------------------------------------------------- */
/* Demo tenant                                                                 */
/* -------------------------------------------------------------------------- */

async function seedDemoTenant(spec: DemoTenantSpec, plans: Record<string, string>, roles: Record<string, string>): Promise<void> {
  const planId = plans[spec.planCode];
  if (!planId) throw new Error(`[seed] plan not found: ${spec.planCode}`);

  /* ---------- Tenant + owner (landlord scope) ---------------------------- */
  const ownerPwd = envPassword('SEED_TENANT_OWNER_PASSWORD', spec.ownerPassword);
  const ownerHash = await hashPassword(ownerPwd);
  const ownerId = await upsertTenantUser({
    email: spec.ownerEmail,
    passwordHash: ownerHash,
    firstName: spec.ownerFirstName,
    lastName: spec.ownerLastName,
  });

  // upsert tenant by unique subdomain
  const tenant = await prismaLandlord.tenant.upsert({
    where: { subdomain: spec.subdomain },
    update: { name: spec.name, planId, status: spec.status, ownerUserId: ownerId },
    create: {
      subdomain: spec.subdomain,
      name: spec.name,
      planId,
      status: spec.status,
      ownerUserId: ownerId,
      settings: { seeded: true, currency: CURRENCY },
    },
  });
  const tenantId = tenant.id;
  console.log(`[seed] tenant ${spec.subdomain} → ${tenantId}`);

  // owner membership (landlord client, composite PK)
  const ownerRoleId = roles['OWNER'];
  if (!ownerRoleId) throw new Error('[seed] OWNER role missing');
  await prismaLandlord.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: ownerId } },
    update: { roleId: ownerRoleId, acceptedAt: new Date() },
    create: { tenantId, userId: ownerId, roleId: ownerRoleId, acceptedAt: new Date() },
  });

  // staff
  for (const s of spec.staff) {
    const staffHash = await hashPassword(s.password);
    const staffId = await upsertTenantUser({
      email: s.email,
      passwordHash: staffHash,
      firstName: s.firstName,
      lastName: s.lastName,
    });
    const roleId = roles[s.roleCode];
    if (!roleId) throw new Error(`[seed] role missing: ${s.roleCode}`);
    await prismaLandlord.tenantMember.upsert({
      where: { tenantId_userId: { tenantId, userId: staffId } },
      update: { roleId, acceptedAt: new Date() },
      create: { tenantId, userId: staffId, roleId, acceptedAt: new Date() },
    });
    console.log(`[seed]   staff ${s.email} (${s.roleCode})`);
  }

  /* ---------- Tenant-scoped writes (RLS) --------------------------------- */
  await withTenant({ tenantId, userId: ownerId }, async (tx) => {
    await seedBrands(tx, tenantId, spec);
    await seedCategories(tx, tenantId, spec);
    await seedProducts(tx, tenantId, spec);
    const customerMap = await seedCustomers(tx, tenantId, spec);
    await seedOrders(tx, tenantId, spec, customerMap);
    await seedCoupons(tx, tenantId, spec);
  });

  console.log(`[seed] tenant ${spec.subdomain} complete`);
}

async function seedBrands(tx: LocalTx, tenantId: string, spec: DemoTenantSpec): Promise<void> {
  for (const b of spec.brands) {
    await tx.brand.upsert({
      where: { tenantId_slug: { tenantId, slug: b.slug } },
      update: { name: b.name },
      create: { tenantId, slug: b.slug, name: b.name },
    });
  }
}

async function seedCategories(tx: LocalTx, tenantId: string, spec: DemoTenantSpec): Promise<void> {
  // Two-pass: create rows (without parent), then set parentId.
  for (const c of spec.categories) {
    await tx.category.upsert({
      where: { tenantId_slug: { tenantId, slug: c.slug } },
      update: { name: c.name, position: c.position },
      create: { tenantId, slug: c.slug, name: c.name, position: c.position },
    });
  }
  for (const c of spec.categories) {
    if (!c.parent) continue;
    const parent = await tx.category.findUnique({
      where: { tenantId_slug: { tenantId, slug: c.parent } },
    });
    if (!parent) continue;
    await tx.category.update({
      where: { tenantId_slug: { tenantId, slug: c.slug } },
      data: { parentId: parent.id },
    });
  }
}

async function seedProducts(tx: LocalTx, tenantId: string, spec: DemoTenantSpec): Promise<void> {
  const brandMap = new Map<string, string>();
  const brands = await tx.brand.findMany({ where: { tenantId } });
  for (const b of brands) brandMap.set(b.slug, b.id);

  const categoryMap = new Map<string, string>();
  const categories = await tx.category.findMany({ where: { tenantId } });
  for (const c of categories) categoryMap.set(c.slug, c.id);

  for (const p of spec.products) {
    const brandId = p.brand ? brandMap.get(p.brand) ?? null : null;

    const product = await tx.product.upsert({
      where: { tenantId_slug: { tenantId, slug: p.slug } },
      update: {
        title: p.title,
        description: p.description,
        brandId,
        status: 'active',
      },
      create: {
        tenantId,
        slug: p.slug,
        title: p.title,
        description: p.description,
        brandId,
        status: 'active',
      },
    });

    // option (single option: weight / color / size)
    let optionValueMap = new Map<string, string>();
    if (p.optionName && p.variants.some((v) => v.optionValue)) {
      const existing = await tx.productOption.findFirst({
        where: { tenantId, productId: product.id, name: p.optionName },
      });
      const option =
        existing ??
        (await tx.productOption.create({
          data: { tenantId, productId: product.id, name: p.optionName, position: 0 },
        }));

      const values = Array.from(
        new Set(
          p.variants
            .map((v) => v.optionValue)
            .filter((v): v is string => typeof v === 'string'),
        ),
      );
      for (const [idx, value] of values.entries()) {
        const existingVal = await tx.productOptionValue.findFirst({
          where: { tenantId, productOptionId: option.id, value },
        });
        const row =
          existingVal ??
          (await tx.productOptionValue.create({
            data: { tenantId, productOptionId: option.id, value, position: idx },
          }));
        optionValueMap.set(value, row.id);
      }
    }

    // variants
    for (const v of p.variants) {
      const ov1 = v.optionValue ? optionValueMap.get(v.optionValue) ?? null : null;
      await tx.productVariant.upsert({
        where: { tenantId_sku: { tenantId, sku: v.sku } },
        update: {
          productId: product.id,
          priceMinorUnits: v.priceMinorUnits,
          compareAtMinorUnits: v.compareAtMinorUnits ?? null,
          currency: CURRENCY,
          stockOnHand: v.stockOnHand,
          optionValue1Id: ov1,
        },
        create: {
          tenantId,
          productId: product.id,
          sku: v.sku,
          priceMinorUnits: v.priceMinorUnits,
          compareAtMinorUnits: v.compareAtMinorUnits ?? null,
          currency: CURRENCY,
          stockOnHand: v.stockOnHand,
          stockReserved: 0,
          optionValue1Id: ov1,
        },
      });
    }

    // category links
    for (const catSlug of p.categorySlugs) {
      const categoryId = categoryMap.get(catSlug);
      if (!categoryId) continue;
      await tx.categoryProduct.upsert({
        where: {
          tenantId_categoryId_productId: { tenantId, categoryId, productId: product.id },
        },
        update: {},
        create: { tenantId, categoryId, productId: product.id, position: 0 },
      });
    }

    // media
    const url1 = `https://picsum.photos/seed/${p.mediaSeed}/600/600`;
    const existingMedia = await tx.mediaAsset.findFirst({
      where: { tenantId, productId: product.id, url: url1 },
    });
    if (!existingMedia) {
      await tx.mediaAsset.create({
        data: {
          tenantId,
          productId: product.id,
          url: url1,
          mime: 'image/jpeg',
          sizeBytes: 120_000,
          width: 600,
          height: 600,
        },
      });
    }
  }
}

async function seedCustomers(
  tx: LocalTx,
  tenantId: string,
  spec: DemoTenantSpec,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const c of spec.customers) {
    const customer = await tx.customer.upsert({
      where: { tenantId_email: { tenantId, email: c.email } },
      update: { firstName: c.firstName, lastName: c.lastName, phone: c.phone },
      create: {
        tenantId,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        acceptsMarketing: false,
      },
    });
    map.set(c.email, customer.id);

    // default address — upsert by looking for a matching address first
    const existingAddr = await tx.customerAddress.findFirst({
      where: { tenantId, customerId: customer.id, line1: c.line1, postalCode: c.postalCode },
    });
    if (!existingAddr) {
      await tx.customerAddress.create({
        data: {
          tenantId,
          customerId: customer.id,
          fullName: `${c.firstName} ${c.lastName}`,
          phone: c.phone,
          line1: c.line1,
          city: c.city,
          region: c.region,
          postalCode: c.postalCode,
          country: 'TR',
          isDefault: true,
        },
      });
    }
  }
  return map;
}

async function seedOrders(
  tx: LocalTx,
  tenantId: string,
  spec: DemoTenantSpec,
  customers: Map<string, string>,
): Promise<void> {
  // Build SKU → variant+product cache once per tenant
  const variants = await tx.productVariant.findMany({ where: { tenantId } });
  const products = await tx.product.findMany({ where: { tenantId } });
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantBySku = new Map(variants.map((v) => [v.sku, v]));

  for (const o of spec.orders) {
    const customerId = customers.get(o.customerEmail);
    if (!customerId) {
      console.warn(`[seed] order ${o.orderNumber}: customer missing (${o.customerEmail})`);
      continue;
    }

    // Build lines with snapshot totals
    let subtotal = 0n;
    const linesData: Prisma.OrderLineCreateManyOrderInput[] = [];
    for (const line of o.lines) {
      const variant = variantBySku.get(line.sku);
      if (!variant) {
        console.warn(`[seed] order ${o.orderNumber}: SKU missing (${line.sku})`);
        continue;
      }
      const product = productById.get(variant.productId)!;
      const lineTotal = variant.priceMinorUnits * BigInt(line.quantity);
      subtotal += lineTotal;
      linesData.push({
        tenantId,
        productId: product.id,
        variantId: variant.id,
        sku: variant.sku,
        titleSnapshot: product.title,
        priceMinorUnits: variant.priceMinorUnits,
        quantity: line.quantity,
        totalMinorUnits: lineTotal,
      });
    }

    const shipping = o.shippingMinor ?? 0n;
    const discount = o.discountMinor ?? 0n;
    const total = subtotal + shipping - discount;

    const placedAt = new Date();
    placedAt.setUTCDate(placedAt.getUTCDate() - o.daysAgo);

    const statusTimes: {
      paidAt?: Date;
      shippedAt?: Date;
      deliveredAt?: Date;
      cancelledAt?: Date;
    } = {};
    if (['payment_success', 'preparing', 'shipped', 'delivered', 'refund_requested', 'refunded'].includes(o.status)) {
      statusTimes.paidAt = placedAt;
    }
    if (['shipped', 'delivered'].includes(o.status)) {
      const d = new Date(placedAt);
      d.setUTCDate(d.getUTCDate() + 1);
      statusTimes.shippedAt = d;
    }
    if (o.status === 'delivered') {
      const d = new Date(placedAt);
      d.setUTCDate(d.getUTCDate() + 3);
      statusTimes.deliveredAt = d;
    }
    if (o.status === 'cancelled') {
      statusTimes.cancelledAt = placedAt;
    }

    const existing = await tx.order.findUnique({
      where: { tenantId_orderNumber: { tenantId, orderNumber: o.orderNumber } },
    });
    if (existing) {
      // idempotent: skip re-creating lines / status history
      continue;
    }

    await tx.order.create({
      data: {
        tenantId,
        orderNumber: o.orderNumber,
        customerId,
        status: o.status,
        subtotalMinor: subtotal,
        taxMinor: 0n,
        shippingMinor: shipping,
        discountMinor: discount,
        totalMinor: total,
        currency: CURRENCY,
        paymentProvider: 'stub',
        paymentRef: o.status !== 'pending_payment' ? `stub_${o.orderNumber}` : null,
        placedAt,
        ...statusTimes,
        lines: { createMany: { data: linesData } },
        statusHistory: {
          create: {
            tenantId,
            toStatus: o.status,
            occurredAt: placedAt,
            note: 'seed',
          },
        },
      },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Coupons — guarded: model may not exist on older branches (pre-6b merge).    */
/* We dynamically access tx.coupon; if undefined, we skip silently.            */
/* -------------------------------------------------------------------------- */

async function seedCoupons(tx: LocalTx, tenantId: string, spec: DemoTenantSpec): Promise<void> {
  const couponDelegate = (tx as unknown as { coupon?: { upsert: (...args: unknown[]) => Promise<unknown> } }).coupon;
  if (!couponDelegate || typeof couponDelegate.upsert !== 'function') {
    if (spec.coupons.length > 0) {
      console.log(`[seed]   coupon model absent on this schema — skipping ${spec.coupons.length} coupons for ${spec.subdomain}`);
    }
    return;
  }

  for (const c of spec.coupons) {
    const endsAt =
      c.endsAt === 'yesterday'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : c.endsAt instanceof Date
          ? c.endsAt
          : null;

    await (couponDelegate as unknown as {
      upsert: (args: {
        where: { tenantId_code: { tenantId: string; code: string } };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => Promise<unknown>;
    }).upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: {
        type: c.type,
        value: c.value,
        minimumAmount: c.minimumAmount,
        maximumDiscount: c.maximumDiscount,
        isActive: c.isActive,
        endsAt,
      },
      create: {
        tenantId,
        code: c.code,
        type: c.type,
        value: c.value,
        minimumAmount: c.minimumAmount,
        maximumDiscount: c.maximumDiscount,
        isActive: c.isActive,
        endsAt,
        usageCount: 0,
      },
    });
    console.log(`[seed]   coupon ${c.code} ok`);
  }
}

// Silence unused-import warning when the Coupon model is absent at compile time.
void ({} as CouponSeed);
void ({} as CustomerSeed);
void ({} as OrderSeed);
void ({} as ProductSeed);

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  console.log('[seed] start');
  const plans = await seedPlans();
  const roles = await seedSystemRoles();
  await seedLandlordSuperAdmin();
  await seedDemoTenant(kahveDunyasiSpec, plans, roles);
  await seedDemoTenant(modaButikSpec, plans, roles);
  console.log('[seed] complete');
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaLandlord.$disconnect();
  });

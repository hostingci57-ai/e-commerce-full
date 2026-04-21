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
    await seedCmsAndI18n(tx, tenantId);
    await seedTenantSettings(tx, tenantId, spec);
    await seedPaymentMethods(tx, tenantId);
    await seedShippingMethods(tx, tenantId);
    await seedReviews(tx, tenantId, customerMap);
    await seedWishlists(tx, tenantId, customerMap);
    await seedAbandonedCarts(tx, tenantId, customerMap);
    await seedInventoryDemoStates(tx, tenantId, spec.subdomain);
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

    // variants + canonical inventory levels + INITIAL movement
    for (const v of p.variants) {
      const ov1 = v.optionValue ? optionValueMap.get(v.optionValue) ?? null : null;
      const variant = await tx.productVariant.upsert({
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
        select: { id: true },
      });
      await tx.inventoryLevel.upsert({
        where: { tenantId_variantId: { tenantId, variantId: variant.id } },
        update: { stockOnHand: v.stockOnHand },
        create: {
          tenantId,
          variantId: variant.id,
          stockOnHand: v.stockOnHand,
          stockReserved: 0,
          lowStockThreshold: 5,
        },
      });
      const movementExists = await tx.inventoryMovement.findFirst({
        where: {
          tenantId,
          variantId: variant.id,
          type: 'INITIAL',
        },
        select: { id: true },
      });
      if (!movementExists && v.stockOnHand > 0) {
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantId: variant.id,
            type: 'INITIAL',
            quantity: v.stockOnHand,
            reason: 'initial',
          },
        });
      }
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

/**
 * Demo states for the inventory UI — only for the first tenant so charts
 * and alert flows have something interesting to show:
 *
 *   - 5 variants driven down to a low (2–4) count
 *   - 2 variants zeroed out (OOS)
 *
 * Idempotent: writes an ADJUSTMENT movement only if the current on-hand
 * differs from the target.
 */
async function seedInventoryDemoStates(
  tx: LocalTx,
  tenantId: string,
  subdomain: string,
): Promise<void> {
  // Only decorate the first demo tenant's catalog — keeps the second one as
  // a "healthy stock" reference in the admin.
  if (subdomain !== 'kahve') return;
  const variants = await tx.productVariant.findMany({
    where: { tenantId },
    orderBy: { sku: 'asc' },
    select: { id: true, sku: true },
    take: 12,
  });
  if (variants.length < 7) return;
  const LOW_TARGETS = [2, 3, 4, 3, 2]; // 5 low-stock variants
  const OOS_COUNT = 2;
  const plan = [
    ...LOW_TARGETS.map((target, i) => ({ variant: variants[i], target })),
    ...Array.from({ length: OOS_COUNT }, (_, i) => ({
      variant: variants[LOW_TARGETS.length + i],
      target: 0,
    })),
  ];
  for (const p of plan) {
    const cur = await tx.inventoryLevel.findUnique({
      where: { tenantId_variantId: { tenantId, variantId: p.variant.id } },
    });
    if (!cur) continue;
    const delta = p.target - cur.stockOnHand;
    if (delta === 0) continue;
    await tx.inventoryLevel.update({
      where: { tenantId_variantId: { tenantId, variantId: p.variant.id } },
      data: { stockOnHand: p.target },
    });
    await tx.productVariant.update({
      where: { id: p.variant.id },
      data: { stockOnHand: p.target },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        variantId: p.variant.id,
        type: 'ADJUSTMENT',
        quantity: delta,
        reason: p.target === 0 ? 'damage' : 'manual_adjustment',
        note: p.target === 0 ? 'Demo: OOS state' : 'Demo: low-stock state',
      },
    });
  }
  console.log(
    `[seed]   inventory demo: ${LOW_TARGETS.length} low-stock + ${OOS_COUNT} OOS variants in ${subdomain}`,
  );
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

    // Spread orders across a 30-day window for realistic time-series charts.
    // We derive a deterministic offset from the order number so re-runs stay
    // idempotent. pending_payment orders keep their `daysAgo` (≈ today) so the
    // FSD 5.1 "bank-transfer alerts" widget doesn't randomly flip.
    const keepsOriginal =
      o.status === 'pending_payment' ||
      o.status === 'payment_failed' ||
      o.status === 'draft';
    const spreadDays = keepsOriginal
      ? o.daysAgo
      : hashOrderNumber(o.orderNumber) % 30;
    const placedAt = new Date();
    placedAt.setUTCDate(placedAt.getUTCDate() - spreadDays);
    // Also randomise the hour-of-day so `date_trunc('day', ...)` sees events
    // scattered through the day (useful for intraday checks later).
    const hourOffset = (hashOrderNumber(o.orderNumber) >> 5) % 24;
    placedAt.setUTCHours(hourOffset, 0, 0, 0);

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

    // Some orders should use bank_transfer so the dashboard alerts widget has
    // data to render. Deterministic: every 4th order (by hash) flips provider.
    const paymentProvider =
      o.status === 'pending_payment' && hashOrderNumber(o.orderNumber) % 4 === 0
        ? 'bank_transfer'
        : 'stub';

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
        paymentProvider,
        paymentRef: o.status !== 'pending_payment' ? `stub_${o.orderNumber}` : null,
        placedAt,
        // Align createdAt with placedAt so time-series analytics charts aren't
        // skewed by re-seed timestamps.
        createdAt: placedAt,
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

/**
 * Cheap deterministic string hash — FNV-1a 32-bit. Used to spread order
 * `placedAt` / `createdAt` across a 30-day window for realistic analytics
 * charts without introducing randomness (so reruns stay idempotent).
 */
function hashOrderNumber(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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
/* Languages (global catalog) — seeded once with TR/EN/DE                      */
/* -------------------------------------------------------------------------- */

async function seedLanguages(): Promise<void> {
  const langDelegate = (prismaLandlord as unknown as {
    language?: { upsert: (args: unknown) => Promise<unknown> };
  }).language;
  if (!langDelegate || typeof langDelegate.upsert !== 'function') {
    console.log('[seed] language model absent — skipping language seed');
    return;
  }
  const rows = [
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', rtl: false },
    { code: 'en', name: 'English', nativeName: 'English', rtl: false },
    { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  ];
  for (const r of rows) {
    await (langDelegate as {
      upsert: (args: {
        where: { code: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => Promise<unknown>;
    }).upsert({
      where: { code: r.code },
      update: { name: r.name, nativeName: r.nativeName, rtl: r.rtl, isActive: true },
      create: {
        code: r.code,
        name: r.name,
        nativeName: r.nativeName,
        rtl: r.rtl,
        isActive: true,
      },
    });
  }
  console.log('[seed] languages ok (tr,en,de)');
}

/* -------------------------------------------------------------------------- */
/* CMS + i18n defaults per tenant                                              */
/* -------------------------------------------------------------------------- */

async function seedCmsAndI18n(tx: LocalTx, tenantId: string): Promise<void> {
  // Pages model may not exist on older branches — guard.
  const cmsDelegate = (tx as unknown as {
    cmsPage?: { upsert: (args: unknown) => Promise<unknown> };
  }).cmsPage;
  if (!cmsDelegate) {
    console.log(`[seed]   cms/i18n models absent — skipping for ${tenantId}`);
    return;
  }

  const now = new Date();
  const pages = [
    {
      slug: 'hakkimizda',
      title: 'Hakkımızda',
      content:
        '# Hakkımızda\n\nMağazamıza hoş geldiniz. Bu sayfayı tenant panelinden düzenleyebilirsiniz.\n',
      metaTitle: 'Hakkımızda',
      metaDescription: 'Mağazamız hakkında bilgi alın.',
      showInFooter: true,
      sortOrder: 10,
    },
    {
      slug: 'gizlilik-politikasi',
      title: 'Gizlilik Politikası',
      content:
        '# Gizlilik Politikası\n\nKVKK aydınlatma metninizi buradan düzenleyebilirsiniz.\n',
      metaTitle: 'Gizlilik Politikası',
      metaDescription: 'Kişisel verilerin işlenmesi.',
      showInFooter: true,
      sortOrder: 20,
    },
    {
      slug: 'kullanim-sartlari',
      title: 'Kullanım Şartları',
      content:
        '# Kullanım Şartları\n\nMağazamızı kullanırken uyulması gereken şartlar.\n',
      metaTitle: 'Kullanım Şartları',
      metaDescription: 'Kullanım şartları ve iade.',
      showInFooter: true,
      sortOrder: 30,
    },
  ];

  type CmsDelegate = {
    upsert: (args: {
      where: { tenantId_slug: { tenantId: string; slug: string } };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  for (const p of pages) {
    await (cmsDelegate as unknown as CmsDelegate).upsert({
      where: { tenantId_slug: { tenantId, slug: p.slug } },
      update: {},
      create: {
        tenantId,
        slug: p.slug,
        title: p.title,
        content: p.content,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        isPublished: true,
        publishedAt: now,
        showInFooter: p.showInFooter,
        showInHeader: false,
        sortOrder: p.sortOrder,
      },
    });
  }

  const menuDelegate = (tx as unknown as {
    cmsMenu?: {
      upsert: (args: {
        where: { tenantId_key: { tenantId: string; key: string } };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  }).cmsMenu;
  if (menuDelegate) {
    await menuDelegate.upsert({
      where: { tenantId_key: { tenantId, key: 'main' } },
      update: {},
      create: {
        tenantId,
        key: 'main',
        name: 'Ana Menü',
        items: [{ label: 'Tüm Ürünler', type: 'url', target: '/products', sortOrder: 0 }],
        isActive: true,
      },
    });
    await menuDelegate.upsert({
      where: { tenantId_key: { tenantId, key: 'footer' } },
      update: {},
      create: {
        tenantId,
        key: 'footer',
        name: 'Footer',
        items: [
          { label: 'Hakkımızda', type: 'page', target: 'hakkimizda', sortOrder: 0 },
          { label: 'Gizlilik', type: 'page', target: 'gizlilik-politikasi', sortOrder: 10 },
          { label: 'Şartlar', type: 'page', target: 'kullanim-sartlari', sortOrder: 20 },
        ],
        isActive: true,
      },
    });
  }

  // Tenant languages
  const tenantLangDelegate = (tx as unknown as {
    tenantLanguage?: {
      upsert: (args: {
        where: { tenantId_languageCode: { tenantId: string; languageCode: string } };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  }).tenantLanguage;
  if (tenantLangDelegate) {
    await tenantLangDelegate.upsert({
      where: { tenantId_languageCode: { tenantId, languageCode: 'tr' } },
      update: {},
      create: { tenantId, languageCode: 'tr', isDefault: true, isPublished: true },
    });
    await tenantLangDelegate.upsert({
      where: { tenantId_languageCode: { tenantId, languageCode: 'en' } },
      update: {},
      create: { tenantId, languageCode: 'en', isDefault: false, isPublished: true },
    });
  }

  console.log(`[seed]   cms/i18n defaults ok for ${tenantId}`);
}

/* -------------------------------------------------------------------------- */
/* Tenant settings + provider configs                                          */
/* -------------------------------------------------------------------------- */

async function seedTenantSettings(
  tx: LocalTx,
  tenantId: string,
  spec: DemoTenantSpec,
): Promise<void> {
  await tx.tenantSettings.upsert({
    where: { tenantId },
    update: {
      storeName: spec.name,
      storeEmail: spec.ownerEmail,
      currency: spec.currency,
    },
    create: {
      tenantId,
      storeName: spec.name,
      storeEmail: spec.ownerEmail,
      currency: spec.currency,
      defaultLanguage: 'tr',
      timezone: 'Europe/Istanbul',
      primaryColor: '#0ea5e9',
    },
  });
  console.log('[seed]   tenantSettings ok');
}

async function seedPaymentMethods(tx: LocalTx, tenantId: string): Promise<void> {
  const methods = [
    {
      providerCode: 'cod',
      displayName: 'Kapıda Ödeme',
      description: 'Siparişinizi teslim alırken ödersiniz.',
      sortOrder: 0,
    },
    {
      providerCode: 'bank_transfer',
      displayName: 'Banka Havalesi / EFT',
      description: 'IBAN ile ödeme yapıp admin onayı sonrası siparişiniz hazırlanır.',
      config: {
        iban: 'TR00 0000 0000 0000 0000 0000 00',
        accountName: 'Demo Mağaza A.Ş.',
        bank: 'Demo Bank',
      },
      sortOrder: 1,
    },
    {
      providerCode: 'stub_card',
      displayName: 'Kredi Kartı',
      description: 'Simülasyon ödeme — test için.',
      sortOrder: 2,
    },
  ];
  for (const m of methods) {
    await tx.paymentMethodConfig.upsert({
      where: { tenantId_providerCode: { tenantId, providerCode: m.providerCode } },
      update: {},
      create: {
        tenantId,
        providerCode: m.providerCode,
        displayName: m.displayName,
        description: m.description,
        config: (m.config ?? {}) as Prisma.InputJsonValue,
        isActive: true,
        sortOrder: m.sortOrder,
      },
    });
  }
  console.log(`[seed]   paymentMethodConfigs (${methods.length}) ok`);
}

async function seedShippingMethods(tx: LocalTx, tenantId: string): Promise<void> {
  const methods = [
    {
      providerCode: 'flat_rate',
      code: 'standard',
      displayName: 'Standart Kargo',
      description: '2-4 iş günü içinde teslim.',
      config: { priceMinor: '5000' },
      estimatedDaysMin: 2,
      estimatedDaysMax: 4,
      sortOrder: 0,
    },
    {
      providerCode: 'flat_rate',
      code: 'express',
      displayName: 'Ekspres Kargo',
      description: 'Ertesi gün teslim.',
      config: { priceMinor: '12000' },
      estimatedDaysMin: 1,
      estimatedDaysMax: 1,
      sortOrder: 1,
    },
    {
      providerCode: 'free_shipping',
      code: 'free_500',
      displayName: '₺500 üzeri ücretsiz kargo',
      description: 'Sepet tutarı ₺500 ve üzerinde ücretsiz kargo.',
      config: {},
      freeShippingThreshold: BigInt(50_000),
      estimatedDaysMin: 2,
      estimatedDaysMax: 5,
      sortOrder: 2,
    },
  ];
  for (const m of methods) {
    await tx.shippingMethodConfig.upsert({
      where: {
        tenantId_providerCode_code: {
          tenantId,
          providerCode: m.providerCode,
          code: m.code,
        },
      },
      update: {},
      create: {
        tenantId,
        providerCode: m.providerCode,
        code: m.code,
        displayName: m.displayName,
        description: m.description,
        config: m.config as Prisma.InputJsonValue,
        isActive: true,
        sortOrder: m.sortOrder,
        estimatedDaysMin: m.estimatedDaysMin,
        estimatedDaysMax: m.estimatedDaysMax,
        freeShippingThreshold: m.freeShippingThreshold ?? null,
      },
    });
  }
  console.log(`[seed]   shippingMethodConfigs (${methods.length}) ok`);
}

/* -------------------------------------------------------------------------- */
/* Reviews + Wishlist + Abandoned carts (Faz 8b)                               */
/* -------------------------------------------------------------------------- */

async function seedReviews(
  tx: LocalTx,
  tenantId: string,
  customers: Map<string, string>,
): Promise<void> {
  const products = await tx.product.findMany({
    where: { tenantId, status: 'active' },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });
  const customerIds = Array.from(customers.values());
  if (products.length === 0 || customerIds.length === 0) {
    console.log('[seed]   reviews skipped (no products/customers)');
    return;
  }

  // Deterministic mix: (productIdx, customerIdx) → rating/title/comment
  const titles = [
    'Harika ürün!',
    'Beklediğim gibi',
    'Fiyatına göre iyi',
    'Kargolama hızlıydı',
    'Tekrar alırım',
    'Ortalama',
    null,
    'Tavsiye ederim',
    'Eh işte',
    'Süper memnun kaldım',
  ];
  const comments = [
    'Kalitesi için teşekkürler, çok beğendim.',
    'Tam aradığım özelliklere sahip.',
    'Paketleme özenliydi, ürün sorunsuz geldi.',
    'Bu fiyata kaçırılmaz.',
    'Bazı küçük detaylar olsa daha iyi olurmuş.',
    'İlk izlenim olumlu, kullanıp yorumu güncelleyeceğim.',
    null,
    'Tavsiye üzerine aldım, memnun kaldım.',
    'Beklediğimden daha iyi çıktı.',
    'Her şey yolunda, teşekkürler.',
  ];

  let total = 0;
  for (let p = 0; p < products.length; p += 1) {
    const product = products[p];
    const reviewCount = 5 + p; // 5, 6, 7 reviews
    const picked = customerIds.slice(0, Math.min(reviewCount, customerIds.length));
    for (let c = 0; c < picked.length; c += 1) {
      const customerId = picked[c];
      const seed = (p * 7 + c * 3) % 10;
      const rating = ((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5;
      // Every 3rd review from a customer who has a delivered order in seed is
      // verified-buyer; rather than joining, we pick every other one to be
      // APPROVED and the rest PENDING — a realistic moderation mix.
      const isVerifiedBuyer = c % 2 === 0;
      const status = isVerifiedBuyer ? 'APPROVED' : c % 3 === 0 ? 'APPROVED' : 'PENDING';
      await tx.productReview.upsert({
        where: {
          tenantId_productId_customerId: { tenantId, productId: product.id, customerId },
        },
        update: {},
        create: {
          tenantId,
          productId: product.id,
          customerId,
          rating,
          title: titles[seed],
          comment: comments[seed],
          status,
          isVerifiedBuyer,
          helpfulCount: Math.max(0, (seed % 4) - 1),
        },
      });
      total += 1;
    }
  }
  console.log(`[seed]   productReviews (${total}) ok`);
}

async function seedWishlists(
  tx: LocalTx,
  tenantId: string,
  customers: Map<string, string>,
): Promise<void> {
  const customerIds = Array.from(customers.values()).slice(0, 2);
  const products = await tx.product.findMany({
    where: { tenantId, status: 'active' },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });
  if (customerIds.length === 0 || products.length === 0) {
    console.log('[seed]   wishlists skipped');
    return;
  }
  let total = 0;
  for (let c = 0; c < customerIds.length; c += 1) {
    const customerId = customerIds[c];
    const productSlice = products.slice(c, c + 3 + c); // 3..5 items per customer
    for (const p of productSlice) {
      await tx.wishlistItem.upsert({
        where: {
          tenantId_customerId_productId: { tenantId, customerId, productId: p.id },
        },
        update: {},
        create: { tenantId, customerId, productId: p.id },
      });
      total += 1;
    }
  }
  console.log(`[seed]   wishlistItems (${total}) ok`);
}

async function seedAbandonedCarts(
  tx: LocalTx,
  tenantId: string,
  customers: Map<string, string>,
): Promise<void> {
  const variants = await tx.productVariant.findMany({ where: { tenantId }, take: 6 });
  if (variants.length === 0) {
    console.log('[seed]   abandonedCarts skipped (no variants)');
    return;
  }
  const customerIds = Array.from(customers.entries()); // [email, id]
  const samples = [
    {
      cartToken: `cart:t:${tenantId}:g:seed-guest-abandon-1`,
      customerEmail: 'anonim-1@example.local',
      customerId: null as string | null,
      variantIdxs: [0, 1],
      hoursAgo: 26,
      recoveryEmailSent: false,
    },
    {
      cartToken: `cart:t:${tenantId}:g:seed-guest-abandon-2`,
      customerEmail: customerIds[0]?.[0] ?? 'anonim-2@example.local',
      customerId: customerIds[0]?.[1] ?? null,
      variantIdxs: [2, 3, 4],
      hoursAgo: 8,
      recoveryEmailSent: false,
    },
    {
      cartToken: `cart:t:${tenantId}:c:${customerIds[1]?.[1] ?? 'seed-member'}`,
      customerEmail: customerIds[1]?.[0] ?? null,
      customerId: customerIds[1]?.[1] ?? null,
      variantIdxs: [0, 4, 5 % variants.length],
      hoursAgo: 72,
      recoveryEmailSent: true,
    },
  ];

  for (const s of samples) {
    const items = s.variantIdxs
      .map((i) => variants[i])
      .filter((v): v is (typeof variants)[number] => Boolean(v))
      .map((v) => ({
        variantId: v.id,
        productId: v.productId,
        sku: v.sku,
        title: `Ürün ${v.sku}`,
        qty: 1,
        priceMinor: v.priceMinorUnits.toString(),
      }));
    if (items.length === 0) continue;
    const totalAmount = items.reduce(
      (acc, i) => acc + BigInt(i.priceMinor) * BigInt(i.qty),
      0n,
    );
    const createdAt = new Date(Date.now() - s.hoursAgo * 60 * 60 * 1000);
    await tx.abandonedCart.upsert({
      where: { tenantId_cartToken: { tenantId, cartToken: s.cartToken } },
      update: {},
      create: {
        tenantId,
        cartToken: s.cartToken,
        customerId: s.customerId,
        customerEmail: s.customerEmail,
        itemsSnapshot: items as unknown as Prisma.InputJsonValue,
        totalAmount,
        currency: CURRENCY,
        createdAt,
        recoveryEmailSentAt: s.recoveryEmailSent ? new Date(createdAt.getTime() + 60 * 60 * 1000) : null,
      },
    });
  }
  console.log(`[seed]   abandonedCarts (${samples.length}) ok`);
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  console.log('[seed] start');
  const plans = await seedPlans();
  const roles = await seedSystemRoles();
  await seedLandlordSuperAdmin();
  await seedLanguages();
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

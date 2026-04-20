import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@prisma/client';
import { prisma } from './client';

export interface TenantStore {
  tenantId: string | null;
  userId: string | null;
}

const als = new AsyncLocalStorage<TenantStore>();

/** Returns the tenant/user in effect for the current async stack, if any. */
export function getTenantStore(): TenantStore {
  return als.getStore() ?? { tenantId: null, userId: null };
}

/**
 * Run `callback` inside a Prisma interactive transaction that has
 * `app.current_tenant_id` (and optionally `app.current_user_id`) set for
 * RLS. The transaction scope ensures `SET LOCAL` is bounded and reverted
 * automatically when the transaction ends.
 *
 * Prefer this for any tenant-scoped DB work. The AsyncLocalStorage copy
 * of the ids is made available to nested code via `getTenantStore()`.
 */
export async function withTenant<T>(
  params: { tenantId: string; userId?: string | null },
  callback: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  const store: TenantStore = {
    tenantId: params.tenantId,
    userId: params.userId ?? null,
  };

  return als.run(store, async () => {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        params.tenantId,
      );
      if (params.userId) {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.current_user_id', $1, true)`,
          params.userId,
        );
      }
      return callback(tx);
    });
  });
}

/**
 * Run `callback` inside a transaction that explicitly clears tenant scope.
 * Intended for auth endpoints before a tenant is selected (customer login,
 * etc.) and for global writes that should bypass tenant checks.
 *
 * CAUTION: the underlying PrismaClient is still the RLS-enforced one, so
 * any tenant-scoped table will simply return zero rows rather than leak
 * cross-tenant data.
 */
export async function withoutTenant<T>(
  callback: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  return als.run({ tenantId: null, userId: null }, async () => {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '', true)`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '', true)`);
      return callback(tx);
    });
  });
}

/** Re-export a convenient alias for test/admin helpers. */
export { als as tenantAsyncLocalStorage };

import { PrismaClient } from '@prisma/client';

type PrismaLogLevel = 'query' | 'info' | 'warn' | 'error';

interface BuildOptions {
  /** When true, connects as ecf_landlord (BYPASSRLS). Default false -> ecf_app-style access. */
  landlord?: boolean;
  /** Override DATABASE_URL entirely (tests). */
  datasourceUrl?: string;
  /** Pass-through to Prisma log config. */
  logLevels?: PrismaLogLevel[];
}

function build(options: BuildOptions = {}): PrismaClient {
  const url =
    options.datasourceUrl ??
    (options.landlord
      ? process.env.DATABASE_URL_LANDLORD ?? process.env.DATABASE_URL
      : process.env.DATABASE_URL);

  if (!url) {
    throw new Error('[@ecf/db] DATABASE_URL is not set');
  }

  return new PrismaClient({
    datasourceUrl: url,
    log: options.logLevels ?? (process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error']),
  });
}

/**
 * Singletons — survive HMR in dev and process re-imports in tests.
 */
type GlobalWithCache = typeof globalThis & {
  __ecfPrisma?: PrismaClient;
  __ecfPrismaLandlord?: PrismaClient;
};
const g = globalThis as GlobalWithCache;

/** App-role PrismaClient. Always use this for tenant-scoped queries. */
export const prisma: PrismaClient = g.__ecfPrisma ?? (g.__ecfPrisma = build());

/** Landlord PrismaClient (BYPASSRLS). Use only from explicit landlord paths. */
export const prismaLandlord: PrismaClient =
  g.__ecfPrismaLandlord ?? (g.__ecfPrismaLandlord = build({ landlord: true }));

export type { PrismaClient };

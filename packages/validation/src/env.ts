import { z } from 'zod';

/**
 * Runtime environment validation. Parsed at api boot; throws and exits on failure.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url(),
  DATABASE_URL_LANDLORD: z.string().url().optional(),

  REDIS_URL: z.string().url(),
  REDIS_BULL_URL: z.string().url().optional(),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  API_CORS_ORIGINS: z.string().default(''),

  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('ecf-api'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * PEM keys in .env store newlines as the literal two-character sequence `\n`.
 * This normalises them back to real newlines that `jose` and `crypto` expect.
 */
export function normalizePemKey(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

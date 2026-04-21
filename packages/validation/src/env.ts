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
  S3_BUCKET: z.string().default('ecf-media'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  /** Max presigned-upload size in bytes (DAM defence-in-depth). */
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  /** Presigned URL TTL (seconds) for both PUT and GET. */
  MEDIA_URL_TTL: z.coerce.number().int().positive().default(15 * 60),

  // Outbox dispatcher + BullMQ
  OUTBOX_DISPATCH_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  OUTBOX_DISPATCH_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  WORKERS_ENABLED: z.coerce.boolean().default(true),

  // Email
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().default('noreply@platform.local'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),

  // Webhooks
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  WEBHOOK_AUTO_DISABLE_THRESHOLD: z.coerce.number().int().positive().default(10),

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

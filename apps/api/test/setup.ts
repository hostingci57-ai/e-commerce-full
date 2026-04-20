/**
 * Global test setup: load .env so JWT_PRIVATE_KEY / DATABASE_URL are present
 * even outside `pnpm dev`. Does NOT migrate the DB — callers are expected to
 * have a live PG already on file when E2E=1 is set.
 *
 * Loaded via vitest.config.ts `setupFiles`.
 */
import { config as loadEnv } from 'node:process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(__dirname, '..', '..', '..', '.env');
if (existsSync(envPath)) {
  // Minimal .env parser (no extra dep). Respects quoted values.
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1]!;
    let value = m[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}
// Normalise NODE_ENV for test runs.
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
void loadEnv;

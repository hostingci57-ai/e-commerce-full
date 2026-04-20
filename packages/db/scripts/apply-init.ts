/**
 * Apply init-roles.sql with password substitution.
 *
 * Reads ECF_APP_PASSWORD and ECF_LANDLORD_PASSWORD from env, substitutes the
 * `%%PLACEHOLDER%%` tokens in the SQL source, then pipes the rendered SQL to
 * psql via stdin using DATABASE_URL (or a DATABASE_SUPERUSER_URL if provided).
 *
 * Usage: `pnpm --filter @ecf/db db:init`
 *
 * In production, set ECF_APP_PASSWORD / ECF_LANDLORD_PASSWORD to strong
 * random strings from your secret manager. In development, values from
 * .env are sufficient (see .env.example).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    // eslint-disable-next-line no-console
    console.error(`[apply-init] ${name} is required`);
    process.exit(1);
  }
  return v;
}

function escapeSqlLiteral(raw: string): string {
  // Postgres single-quoted strings: double any embedded single quote.
  // We place the value inside the SQL with surrounding quotes, so the token
  // must not contain newlines or other control chars — validate for safety.
  if (/[\r\n\0]/.test(raw)) {
    throw new Error('password contains illegal control characters');
  }
  return raw.replace(/'/g, "''");
}

function main(): void {
  const appPw = requireEnv('ECF_APP_PASSWORD');
  const landlordPw = requireEnv('ECF_LANDLORD_PASSWORD');

  const sqlPath = resolve(__dirname, '..', 'prisma', 'init-roles.sql');
  const rlsPath = resolve(__dirname, '..', 'prisma', 'rls.sql');

  const initSql = readFileSync(sqlPath, 'utf8')
    .replace(/%%ECF_APP_PASSWORD%%/g, escapeSqlLiteral(appPw))
    .replace(/%%ECF_LANDLORD_PASSWORD%%/g, escapeSqlLiteral(landlordPw));

  const rlsSql = readFileSync(rlsPath, 'utf8');

  const connUrl =
    process.env.DATABASE_SUPERUSER_URL ?? process.env.DATABASE_URL ?? '';
  if (!connUrl) {
    // eslint-disable-next-line no-console
    console.error('[apply-init] DATABASE_URL (or DATABASE_SUPERUSER_URL) required');
    process.exit(1);
  }

  const runPsql = (sql: string, label: string): void => {
    const res = spawnSync('psql', [connUrl, '-v', 'ON_ERROR_STOP=1'], {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (res.error) {
      // eslint-disable-next-line no-console
      console.error(`[apply-init] failed to spawn psql: ${res.error.message}`);
      process.exit(1);
    }
    if (res.status !== 0) {
      // eslint-disable-next-line no-console
      console.error(`[apply-init] psql exited ${res.status} for ${label}`);
      process.exit(res.status ?? 1);
    }
  };

  runPsql(initSql, 'init-roles.sql');
  runPsql(rlsSql, 'rls.sql');
  // eslint-disable-next-line no-console
  console.log('[apply-init] init-roles + rls applied successfully');
}

main();

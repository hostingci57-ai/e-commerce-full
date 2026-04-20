/**
 * E2E tests need a reachable Postgres + Redis. When neither is wired up
 * (CI without Docker, or a sandbox run), we skip the whole e2e tier cleanly.
 *
 * Set `E2E=1` AND have DATABASE_URL + REDIS_URL reachable to opt in.
 */
export function e2eEnabled(): boolean {
  if (process.env.SKIP_E2E === '1') return false;
  if (process.env.E2E !== '1') return false;
  if (!process.env.DATABASE_URL) return false;
  if (!process.env.REDIS_URL) return false;
  return true;
}

export const skipIfNoE2e: { skip: boolean } = { skip: !e2eEnabled() };

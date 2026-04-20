import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts', 'test/**/*.e2e-spec.ts'],
    globals: false,
    environment: 'node',
    // The @ecf/db client lazily instantiates Prisma at import time and requires
    // DATABASE_URL to be set. Unit tests don't hit the DB — stub the URL so
    // transitive imports succeed.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://test:test@localhost:5432/test_placeholder',
    },
  },
});

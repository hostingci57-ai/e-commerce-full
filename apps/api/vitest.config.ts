import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts', 'test/**/*.e2e-spec.ts'],
    globals: false,
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 60_000,
    setupFiles: ['test/setup.ts'],
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://test:test@localhost:5432/test_placeholder',
    },
  },
});

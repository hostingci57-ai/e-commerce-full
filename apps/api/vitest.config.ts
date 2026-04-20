import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts', 'test/**/*.e2e-spec.ts'],
    globals: false,
    environment: 'node',
  },
});

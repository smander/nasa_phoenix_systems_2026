import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['apps/web/src/**/*.test.{ts,tsx}', 'packages/core/src/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [['apps/web/src/**/*.test.tsx', 'jsdom']],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
  },
}));

import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@': path.resolve(__dirname, 'client', 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Playwright specs (npm run test:e2e); vitest's default include would collect them.
    exclude: [...configDefaults.exclude, 'test/e2e/**'],
  },
});

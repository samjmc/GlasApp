import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@': path.resolve(__dirname, 'client', 'src'),
    },
  },
  // The React 17+ JSX transform, as the Vite build uses: components do not import React.
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    // Node for everything; a component test opts into a DOM with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['client/src/test/setup.ts'],
    // Playwright specs (npm run test:e2e); vitest's default include would collect them.
    exclude: [...configDefaults.exclude, 'test/e2e/**'],
  },
});

/**
 * Browser e2e (npm run test:e2e). The webServer builds the app for production, prepares a
 * throwaway `<db>_e2e` database (test/e2e/prepare-db.ts) and starts the built server on it.
 *
 * Needs a local, disposable Postgres in TEST_DATABASE_URL. Never point it at GlasCore.
 */
import { defineConfig, devices } from '@playwright/test';
import { testDatabaseUrl } from './server/testing/migrations';
import { BLANKED_ENV } from './test/e2e/harness';

const databaseUrl = testDatabaseUrl('e2e');
if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. The e2e suite needs a throwaway local Postgres:\n' +
      '  docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16\n' +
      '  $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"',
  );
}

// Fixed, not random: every worker loads this file again, and a random port would differ.
const PORT = Number(process.env.E2E_PORT || 5055);
const baseURL = `http://127.0.0.1:${PORT}`;
// Nothing listens on port 9, so any Supabase call fails at once instead of reaching GlasCore.
const NO_SUPABASE = 'http://127.0.0.1:9';

export default defineConfig({
  testDir: './test/e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    // The production build registers /sw.js (client/src/pwa.ts).
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && node node_modules/tsx/dist/cli.mjs test/e2e/prepare-db.ts && node dist/index.js',
    url: `${baseURL}/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...Object.fromEntries(BLANKED_ENV.map((key) => [key, ''])),
      NODE_ENV: 'production',
      PORT: String(PORT),
      DATABASE_URL: databaseUrl,
      SCHEDULER: 'off',
      SUPABASE_URL: NO_SUPABASE,
      SUPABASE_ANON_KEY: 'e2e-dummy',
      SUPABASE_SERVICE_ROLE_KEY: 'e2e-dummy',
      // Baked into the client by the build; without them the client points at GlasCore.
      VITE_SUPABASE_URL: NO_SUPABASE,
      VITE_SUPABASE_ANON_KEY: 'e2e-dummy',
    },
  },
});

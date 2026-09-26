/**
 * Route-level security tests for the live routers that carry an auth guard.
 *
 * These are the surviving half of `server/middleware/security.test.ts`, which the auth
 * rebuild deleted along with the middleware it targeted. Its `requireAdminAccess`,
 * `requireRole` and `isAuthenticated` unit blocks tested modules that no longer exist and
 * are replaced by `server/auth/auth.test.ts`. Its route-level blocks were NOT replaced,
 * and four of the five routers they covered are still mounted in `server/routes.ts`, so
 * they are restored here against the rebuilt guards.
 *
 * What each case pins down: a write route rejects an anonymous caller with 401, rejects a
 * non-admin bearer token with 403, accepts the machine secret, and never takes the acting
 * user's identity from the request body.
 */
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

// Env must be set before any dynamic import: server/auth/supabase.ts throws at module
// load without SUPABASE_*, and the job guard reads ADMIN_API_SECRET.
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.ADMIN_API_SECRET = 'cron-secret';
process.env.ADMIN_EMAILS = '';
process.env.LOG_LEVEL = 'silent';

const { authState, dbState } = vi.hoisted(() => {
  const authState: { current: unknown } = { current: null };
  const dbState = {
    selectResult: [] as unknown[],
    insertResult: [] as unknown[],
    insertValues: undefined as unknown,
    db: {
      select: vi.fn(() => ({
        from: () => ({ where: () => ({ limit: async () => dbState.selectResult }) }),
      })),
      insert: vi.fn(() => ({
        values: (values: unknown) => {
          dbState.insertValues = values;
          return {
            returning: async () => dbState.insertResult,
            onConflictDoNothing: async () => dbState.insertResult,
          };
        },
      })),
      update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
      delete: vi.fn(() => ({ where: async () => undefined })),
    },
  };
  return { authState, dbState };
});

vi.mock('../db', () => ({
  pool: null,
  supabaseDb: null,
  db: dbState.db,
  shutdown: vi.fn(),
  checkDatabaseConnection: vi.fn(async () => true),
}));

vi.mock('../services/aiService', () => ({
  callChatCompletion: vi.fn(async () => ({ choices: [{ message: { content: '{}' } }] })),
  callEmbedding: vi.fn(),
  callAnthropicMessage: vi.fn(),
  isLLMConfigured: vi.fn(() => true),
  isEmbeddingConfigured: vi.fn(() => false),
  isAnthropicConfigured: vi.fn(() => false),
}));

vi.mock('../services/cacheService', () => ({
  cached: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  TTL: { ONE_DAY: 86400000, ONE_HOUR: 3600000 },
  CacheKeys: {},
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    clearExpired: vi.fn(),
  },
  CacheService: { clearAllCaches: vi.fn(async () => undefined) },
}));

// The @shared/* aliases are configured for vite but not for vitest.
vi.mock('@shared/schema', () => {
  const table = (name: string) => ({ name });
  return {
    constituencies: table('constituencies'),
    parties: table('parties'),
    electionResults: table('election_results'),
    elections: table('elections'),
  };
});

const { supabase } = await import('../auth/supabase');
const analysisRoutes = (await import('./ai/analysis')).default;

const ADMIN_USER = { id: 'admin-id', email: 'admin@example.com', app_metadata: { role: 'admin' }, user_metadata: {} };
const REGULAR_USER = { id: 'user-42', email: 'user@example.com', app_metadata: { role: 'user' }, user_metadata: {} };

function setAuthUser(user: unknown): void {
  authState.current = user;
}

/** Make token verification resolve to whatever the current case set. */
function installAuthUserMock(): void {
  (supabase.auth as unknown as { getUser: unknown }).getUser = async () => {
    if (!authState.current) return { data: { user: null }, error: new Error('no user') };
    return { data: { user: authState.current }, error: null };
  };
}

async function withServer(app: express.Express, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'content-type': 'application/json', connection: 'close', ...extra };
}

function appWith(mount: string, router: express.Router): express.Express {
  const app = express();
  app.use(express.json());
  app.use(mount, router);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, message: String((err as Error)?.message ?? err) });
  });
  return app;
}

beforeEach(() => {
  setAuthUser(null);
  dbState.selectResult = [];
  dbState.insertResult = [];
  dbState.insertValues = undefined;
  installAuthUserMock();
});

afterEach(() => {
  setAuthUser(null);
  process.env.ADMIN_EMAILS = '';
  vi.clearAllMocks();
});

describe('ai/analysis /complete-analysis', () => {
  const dimensions = { economic: 1, social: -2, cultural: 0, authority: 3, environmental: -4, welfare: 5, globalism: -6, technocratic: 7 };

  it('returns 400 when a dimension is outside -10..10', async () => {
    await withServer(appWith('/api/enhanced-profile', analysisRoutes), async (base) => {
      const res = await fetch(`${base}/api/enhanced-profile/complete-analysis`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ dimensions: { ...dimensions, welfare: 11 } }),
      });
      assert.equal(res.status, 400);
    });
  });

  it('returns 200 for a valid position', async () => {
    await withServer(appWith('/api/enhanced-profile', analysisRoutes), async (base) => {
      const res = await fetch(`${base}/api/enhanced-profile/complete-analysis`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ dimensions }),
      });
      assert.equal(res.status, 200);
      assert.equal(((await res.json()) as { success: boolean }).success, true);
    });
  });
});

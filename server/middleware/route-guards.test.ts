/**
 * Route-guard regression tests for the 2026-09-21 route-security truth audit.
 *
 * Covers the surfaces that audit found writable without any guard, the new
 * rate limiter, the production SESSION_SECRET check, and structural markers
 * that catch a silent revert of the guard insertions.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, describe, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.ADMIN_API_SECRET = 'audit-secret';
process.env.ADMIN_EMAILS = '';
process.env.LOG_LEVEL = 'silent';

vi.mock('../db', () => ({
  pool: null,
  supabaseDb: null,
  db: {
    select: vi.fn(() => ({ from: () => ({ where: async () => [] }) })),
    insert: vi.fn(() => ({ values: () => ({ returning: async () => [] }) })),
    update: vi.fn(() => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) })),
    delete: vi.fn(() => ({ where: () => ({ returning: async () => [] }) })),
  },
  shutdown: vi.fn(),
  checkDatabaseConnection: vi.fn(async () => true),
}));

vi.mock('../replitAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/pledgeScoring', () => ({
  calculatePledgeScore: vi.fn(async () => 0),
  calculatePartyPerformanceScores: vi.fn(async () => ({})),
}));

vi.mock('../services/cacheService', () => ({
  cached: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  TTL: { ONE_DAY: 86400000, ONE_HOUR: 3600000 },
  CacheKeys: {},
  cache: { get: vi.fn(async () => null), set: vi.fn(), del: vi.fn(), delete: vi.fn() },
}));

vi.mock('@shared/schema', async () => {
  const { z } = await import('zod');
  const table = (name: string) => ({ name, id: `${name}.id` });
  return {
    pledges: table('pledges'),
    pledgeActions: table('pledge_actions'),
    partyPerformanceScores: table('party_performance_scores'),
    parties: table('parties'),
    insertPledgeSchema: z.object({ partyId: z.number(), title: z.string() }),
  };
});

const pledgesRoutes = (await import('../routes/political/pledges')).default;
const partiesRoutes = (await import('../routes/political/parties')).default;
const debatesRoutes = (await import('../routes/debatesRoutes')).default;
const { createRateLimit } = await import('./rateLimit');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

function json(extra: Record<string, string> = {}): Record<string, string> {
  return { 'content-type': 'application/json', connection: 'close', ...extra };
}

function appWith(mount: string, router: express.Router): express.Express {
  const app = express();
  app.use(express.json());
  app.use(mount, router);
  // Swallow handler errors so a guard that PASSED shows up as 4xx/5xx, not a hang.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, message: String((err as Error)?.message ?? err) });
  });
  return app;
}

const ADMIN = { 'x-admin-secret': 'audit-secret' };

afterEach(() => {
  vi.clearAllMocks();
});

describe('unguarded write surfaces found by the audit now require admin access', () => {
  const cases: Array<{ name: string; mount: string; router: express.Router; method: string; path: string; body?: unknown }> = [
    { name: 'POST /pledges', mount: '/api/pledges', router: pledgesRoutes, method: 'POST', path: '/api/pledges', body: { partyId: 1, title: 'x' } },
    { name: 'PUT /pledges/:id', mount: '/api/pledges', router: pledgesRoutes, method: 'PUT', path: '/api/pledges/1', body: { title: 'x' } },
    { name: 'DELETE /pledges/:id', mount: '/api/pledges', router: pledgesRoutes, method: 'DELETE', path: '/api/pledges/1' },
    { name: 'POST /pledges/:id/actions', mount: '/api/pledges', router: pledgesRoutes, method: 'POST', path: '/api/pledges/1/actions', body: { actionType: 'a', description: 'd', actionDate: '2026-01-01' } },
    { name: 'POST /pledges/:id/recalculate', mount: '/api/pledges', router: pledgesRoutes, method: 'POST', path: '/api/pledges/1/recalculate' },
    { name: 'POST /pledges/performance/:partyId/recalculate', mount: '/api/pledges', router: pledgesRoutes, method: 'POST', path: '/api/pledges/performance/1/recalculate' },
    { name: 'POST /parties/explanations/:partyId', mount: '/api/parties', router: partiesRoutes, method: 'POST', path: '/api/parties/explanations/1', body: { economic: 'x' } },
    { name: 'POST /debates/alerts/:id/status', mount: '/api/debates', router: debatesRoutes, method: 'POST', path: '/api/debates/alerts/abc/status', body: { status: 'resolved' } },
  ];

  for (const c of cases) {
    it(`${c.name}: 401 without credentials`, async () => {
      await withServer(appWith(c.mount, c.router), async (base) => {
        const res = await fetch(base + c.path, {
          method: c.method,
          headers: json(),
          body: c.body ? JSON.stringify(c.body) : undefined,
        });
        assert.equal(res.status, 401);
        const body = (await res.json()) as { success: boolean; message: string };
        assert.equal(body.success, false);
        assert.match(body.message, /Authentication required/);
      });
    });

    it(`${c.name}: guard passes with the admin job secret`, async () => {
      await withServer(appWith(c.mount, c.router), async (base) => {
        const res = await fetch(base + c.path, {
          method: c.method,
          headers: json(ADMIN),
          body: c.body ? JSON.stringify(c.body) : undefined,
        });
        // Downstream is mocked (no DB), so anything except an auth denial proves
        // the guard let the request through.
        assert.notEqual(res.status, 401, `expected guard to pass, got 401`);
        assert.notEqual(res.status, 403, `expected guard to pass, got 403`);
      });
    });
  }
});

describe('createRateLimit', () => {
  function limitedApp(max: number): express.Express {
    const app = express();
    app.set('trust proxy', 1);
    app.use(createRateLimit({ windowMs: 60_000, max, name: 'test' }));
    app.get('/x', (_req, res) => res.json({ ok: true }));
    app.post('/x', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('returns 429 with Retry-After once a client exceeds max writes in the window', async () => {
    await withServer(limitedApp(2), async (base) => {
      const statuses: number[] = [];
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${base}/x`, { method: 'POST', headers: json() });
        statuses.push(res.status);
        if (i === 2) {
          assert.ok(res.headers.get('retry-after'), 'Retry-After header missing on 429');
          const body = (await res.json()) as { success: boolean; retryAfterSeconds: number };
          assert.equal(body.success, false);
          assert.ok(body.retryAfterSeconds >= 1);
        }
      }
      assert.deepEqual(statuses, [200, 200, 429]);
    });
  });

  it('does not count GET requests', async () => {
    await withServer(limitedApp(1), async (base) => {
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await fetch(`${base}/x`, { headers: json() });
        statuses.push(res.status);
      }
      assert.deepEqual(statuses, [200, 200, 200, 200]);
    });
  });

  it('keys buckets per client IP', async () => {
    await withServer(limitedApp(1), async (base) => {
      const first = await fetch(`${base}/x`, { method: 'POST', headers: json({ 'x-forwarded-for': '10.0.0.1' }) });
      const second = await fetch(`${base}/x`, { method: 'POST', headers: json({ 'x-forwarded-for': '10.0.0.1' }) });
      const other = await fetch(`${base}/x`, { method: 'POST', headers: json({ 'x-forwarded-for': '10.0.0.2' }) });
      assert.equal(first.status, 200);
      assert.equal(second.status, 429);
      assert.equal(other.status, 200);
    });
  });
});

describe('sessionMiddleware', () => {
  it('refuses to start in production without SESSION_SECRET', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    vi.resetModules();
    try {
      await assert.rejects(import('./sessionMiddleware'), /SESSION_SECRET must be set in production/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret !== undefined) process.env.SESSION_SECRET = prevSecret;
      vi.resetModules();
    }
  });
});

describe('structural markers (catch a silent revert of the audit fixes)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

  it('POST /api/quiz-results no longer reads userId from the request body', () => {
    const src = read('server/routes.ts');
    assert.equal(src.includes('validatedData.userId'), false);
    assert.ok(src.includes('const sessionUserId = req.session?.userId ?? null'));
  });

  it('every pledge write route carries requireAdminAccess', () => {
    const src = read('server/routes/political/pledges.ts');
    const writes = src.match(/router\.(post|put|delete)\(/g) ?? [];
    const guarded = src.match(/router\.(post|put|delete)\([^,]+,\s*requireAdminAccess,/g) ?? [];
    // 6 CRUD/recalculate writes are admin-only; /category-votes keeps its own guard.
    assert.equal(guarded.length, 6);
    assert.equal(writes.length, 7);
  });

  it('party explanations and debate alert status writes are admin-only', () => {
    assert.match(read('server/routes/political/parties.ts'), /router\.post\("\/explanations\/:partyId",\s*requireAdminAccess,/);
    assert.match(read('server/routes/debatesRoutes.ts'), /router\.post\('\/alerts\/:alertId\/status',\s*requireAdminAccess,/);
  });

  it('LLM and anonymous-write mounts are rate limited', () => {
    const src = read('server/routes.ts');
    for (const mount of ['/api/ai', '/api/chat', '/api/constituency/story', '/api/personalized-insights', '/api/enhanced-profile']) {
      const re = new RegExp(`app\\.use\\("${mount.replace(/\//g, '\\/')}",\\s*aiRateLimit,`);
      assert.match(src, re, `${mount} is not behind aiRateLimit`);
    }
    assert.match(src, /app\.use\("\/api\/ratings",\s*publicWriteRateLimit,/);
  });

  it('the unmounted fake-login router is gone', () => {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'server/routes/session-auth/index.ts')), false);
  });
});

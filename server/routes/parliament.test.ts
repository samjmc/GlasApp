/**
 * /api/parliament router against a mocked parliament module: envelope, validation,
 * 404s, and the sync trigger's guard and lock.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.ADMIN_API_SECRET = 'parliament-secret';
process.env.LOG_LEVEL = 'silent';

const { state } = vi.hoisted(() => ({ state: { running: false, syncs: 0 } }));

vi.mock('../db', () => ({ db: {}, pool: {}, supabaseDb: null, shutdown: vi.fn(), checkDatabaseConnection: vi.fn() }));

vi.mock('../parliament', () => ({
  isSyncRunning: () => state.running,
  runSync: vi.fn(async () => {
    state.syncs++;
    return {};
  }),
  repository: {
    syncStatus: vi.fn(async () => [{ feed: 'divisions', throughDate: '2025-06-30', lastRunAt: '2025-06-30T04:00:00.000Z', lastResult: 'ok' }]),
    tdSummary: vi.fn(async (id: number) => (id === 1 ? { tdId: 1, attendancePct: 45.4 } : null)),
    votesOf: vi.fn(async (_id: number, opts: { limit: number; againstParty: boolean }) => [{ divisionId: 'd', ...opts }]),
    tdDebates: vi.fn(async () => []),
    listDivisions: vi.fn(async (limit: number, offset: number) => ({ rows: [{ id: 'dail-34-2025-06-25-vote_91', limit, offset }], total: 403 })),
    divisionDetail: vi.fn(async (id: string) => (id === 'dail-34-2025-06-25-vote_91' ? { id } : null)),
    listDebates: vi.fn(async () => ({ rows: [], total: 0 })),
    debateDetail: vi.fn(async () => null),
    leaderboard: vi.fn(async (metric: string, order: string, limit: number) => [{ metric, order, limit }]),
    parties: vi.fn(async () => []),
  },
}));

const router = (await import('./parliament')).default;

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/parliament', router);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/parliament`;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  state.running = false;
  state.syncs = 0;
});

const get = async (path: string) => {
  const res = await fetch(base + path, { headers: { connection: 'close' } });
  return { status: res.status, body: (await res.json()) as { success: boolean; data?: unknown; meta?: Record<string, unknown> } };
};

describe('/api/parliament reads', () => {
  it('wraps data in the envelope, with the total for paged lists', async () => {
    const { status, body } = await get('/divisions?limit=5&offset=10');
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, data: [{ limit: 5, offset: 10 }], meta: { total: 403 } });
    expect((await get('/status')).body.data).toMatchObject({ feeds: [{ feed: 'divisions' }] });
  });

  it('404s an unknown TD or division, 400s a malformed id', async () => {
    expect((await get('/tds/1')).status).toBe(200);
    expect((await get('/tds/2')).status).toBe(404);
    expect((await get('/tds/abc')).status).toBe(400);
    expect((await get('/divisions/dail-34-2025-06-25-vote_91')).status).toBe(200);
    expect((await get('/divisions/dail-34-2025-06-25-vote_92')).status).toBe(404);
    expect((await get('/divisions/..%2F..%2Fetc')).status).toBe(400);
  });

  it('passes the vote filters through and caps the paging', async () => {
    expect((await get('/tds/1/votes?limit=3&againstParty=true')).body.data).toEqual([{ divisionId: 'd', limit: 3, againstParty: true }]);
    expect((await get('/divisions?limit=1000')).status).toBe(400);
  });

  it('validates the leaderboard metric', async () => {
    expect((await get('/leaderboard?metric=questions&order=asc&limit=5')).body.data).toEqual([{ metric: 'questions', order: 'asc', limit: 5 }]);
    expect((await get('/leaderboard?metric=vibes')).status).toBe(400);
  });
});

describe('POST /api/parliament/sync', () => {
  const post = (headers: Record<string, string> = {}) =>
    fetch(`${base}/sync`, { method: 'POST', headers: { connection: 'close', ...headers } });

  it('needs the job secret', async () => {
    expect((await post()).status).toBe(401);
    expect(state.syncs).toBe(0);
  });

  it('starts a sync, and refuses a second while one runs', async () => {
    expect((await post({ 'x-admin-secret': 'parliament-secret' })).status).toBe(202);
    expect(state.syncs).toBe(1);
    state.running = true;
    expect((await post({ 'x-admin-secret': 'parliament-secret' })).status).toBe(409);
    expect(state.syncs).toBe(1);
  });
});

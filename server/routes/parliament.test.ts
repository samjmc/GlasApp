/**
 * /api/parliament router against a mocked parliament module: envelope, validation,
 * 404s, the sync trigger's guard and lock, and the admin leave-watch routes.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.ADMIN_API_SECRET = 'parliament-secret';
process.env.LOG_LEVEL = 'silent';

const { state, LeaveAlertError } = vi.hoisted(() => ({
  state: { running: false, syncs: 0 },
  LeaveAlertError: class extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock('../db', () => ({ db: {}, pool: {}, supabaseDb: null, shutdown: vi.fn(), checkDatabaseConnection: vi.fn() }));

// requireAdmin verifies a Supabase token, which auth.test.ts covers. Here it is a header check,
// so these tests prove each leave-watch route sits behind a guard and what it does behind it.
vi.mock('../auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth')>()),
  requireAdmin: (req: { headers: Record<string, string>; user?: unknown }, res: import('express').Response, next: () => void) => {
    if (req.headers['x-test-admin'] !== 'yes') return void res.status(403).json({ success: false });
    req.user = { id: 'u1', email: 'admin@example.test' };
    next();
  },
  logAdminAction: vi.fn(),
}));

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
    tdCommittees: vi.fn(async (id: number) => [{ committeeId: 'committee_of_public_accounts', id }]),
    tdBills: vi.fn(async (id: number, limit: number) => [{ id: '2026-90', limit }]),
    tdQuestionTopics: vi.fn(async () => [{ department: 'Health', oral: 1, written: 2 }]),
    listBills: vi.fn(async (filters: object, limit: number, offset: number) => ({ rows: [{ filters, limit, offset }], total: 414 })),
    billDetail: vi.fn(async (id: string) => (id === '2026-90' ? { id } : null)),
    tdDebateRecord: vi.fn(async (id: number) => (id === 1 ? { rulesVersion: 'r1', pointsPerDebate: 2.5 } : null)),
    debateRecord: vi.fn(async (id: string) => (id === 'dail-2026-09-16-dbsect_20' ? { debateId: id, participants: [] } : null)),
  },
  leaveWatch: {
    LeaveAlertError,
    listLeaveAlerts: vi.fn(async (scope: string) => [{ id: 1, scope }]),
    confirmLeave: vi.fn(async (id: number) => {
      if (id === 404) throw new LeaveAlertError(404, 'Alert 404 not found');
      if (id === 409) throw new LeaveAlertError(409, 'Alert 409 is already confirmed');
      if (id === 400) throw new LeaveAlertError(400, 'source must be an https URL');
    }),
    dismissLeave: vi.fn(async (id: number) => {
      if (id === 409) throw new LeaveAlertError(409, 'Alert 409 is already dismissed');
    }),
  },
}));

const router = (await import('./parliament')).default;
const { leaveWatch } = await import('../parliament');

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

  it('serves a TD committees, bills and question topics, and 400s a bad id', async () => {
    expect((await get('/tds/1/committees')).body.data).toEqual([{ committeeId: 'committee_of_public_accounts', id: 1 }]);
    expect((await get('/tds/1/bills?limit=5')).body.data).toEqual([{ id: '2026-90', limit: 5 }]);
    expect((await get('/tds/1/question-topics')).body.data).toEqual([{ department: 'Health', oral: 1, written: 2 }]);
    expect((await get('/tds/x/committees')).status).toBe(400);
    expect((await get('/tds/1/bills?limit=0')).status).toBe(400);
  });

  it('lists bills with filters and paging, and serves one bill', async () => {
    const { body } = await get('/bills?status=Enacted&source=Private%20Member&limit=5&offset=10');
    expect(body).toMatchObject({ data: [{ filters: { status: 'Enacted', source: 'Private Member' }, limit: 5, offset: 10 }], meta: { total: 414 } });
    expect((await get('/bills/2026-90')).status).toBe(200);
    expect((await get('/bills/2026-91')).status).toBe(404);
    expect((await get('/bills/..%2Fetc')).status).toBe(400);
    expect((await get(`/bills?status=${'x'.repeat(41)}`)).status).toBe(400);
  });

  it('serves the debate record, null when nothing has been read, and 400s a bad id', async () => {
    expect((await get('/tds/1/debate-record')).body).toEqual({ success: true, data: { rulesVersion: 'r1', pointsPerDebate: 2.5 } });
    expect((await get('/tds/2/debate-record')).body).toMatchObject({ success: true, data: null });
    expect((await get('/tds/x/debate-record')).status).toBe(400);
    expect((await get('/debate-records/dail-2026-09-16-dbsect_20')).body.data).toEqual({ debateId: 'dail-2026-09-16-dbsect_20', participants: [] });
    expect((await get('/debate-records/dail-2026-01-01-dbsect_1')).body).toMatchObject({ success: true, data: null });
    expect((await get('/debate-records/..%2Fetc')).status).toBe(400);
  });

  it('validates the leaderboard metric', async () => {
    expect((await get('/leaderboard?metric=questions&order=asc&limit=5')).body.data).toEqual([{ metric: 'questions', order: 'asc', limit: 5 }]);
    expect((await get('/leaderboard?metric=vibes')).status).toBe(400);
    expect((await get('/leaderboard?metric=committees')).body.data).toEqual([{ metric: 'committees', order: 'desc', limit: 20 }]);
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

describe('/api/parliament/admin/leave-alerts', () => {
  const ADMIN = { 'x-test-admin': 'yes' };
  const send = async (method: string, path: string, body?: unknown, headers: Record<string, string> = ADMIN) => {
    const res = await fetch(base + path, {
      method,
      headers: { connection: 'close', 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as { success: boolean; data?: unknown; error?: { message: string } } };
  };
  const leave = {
    reason: 'medical_leave',
    from: '2026-03-03',
    to: null,
    sourceUrl: 'https://example.test/announcement',
    note: 'Announced by the party.',
  };

  it('is closed to anyone who is not an admin, on every route', async () => {
    for (const [method, path, body] of [
      ['GET', '/admin/leave-alerts', undefined],
      ['POST', '/admin/leave-alerts/1/confirm', leave],
      ['POST', '/admin/leave-alerts/1/dismiss', { note: null }],
    ] as const) {
      expect((await send(method, path, body, {})).status, `${method} ${path}`).toBe(403);
    }
    expect(leaveWatch.confirmLeave).not.toHaveBeenCalled();
    expect(leaveWatch.dismissLeave).not.toHaveBeenCalled();
  });

  it('lists open alerts by default and all of them on request', async () => {
    expect((await send('GET', '/admin/leave-alerts')).body.data).toEqual([{ id: 1, scope: 'open' }]);
    expect((await send('GET', '/admin/leave-alerts?status=all')).body.data).toEqual([{ id: 1, scope: 'all' }]);
    expect((await send('GET', '/admin/leave-alerts?status=nope')).status).toBe(400);
  });

  it('confirms with the source and the admin who confirmed it', async () => {
    const res = await send('POST', '/admin/leave-alerts/7/confirm', leave);
    expect(res).toMatchObject({ status: 200, body: { success: true, data: { confirmed: true } } });
    expect(leaveWatch.confirmLeave).toHaveBeenCalledWith(7, leave, 'admin@example.test');
  });

  it('answers the domain errors with their status, and bad input with 400', async () => {
    expect((await send('POST', '/admin/leave-alerts/404/confirm', leave)).status).toBe(404);
    expect((await send('POST', '/admin/leave-alerts/409/confirm', leave)).status).toBe(409);
    expect((await send('POST', '/admin/leave-alerts/400/confirm', leave)).status).toBe(400);
    expect((await send('POST', '/admin/leave-alerts/x/confirm', leave)).status).toBe(400);
    expect((await send('POST', '/admin/leave-alerts/1/confirm', { ...leave, reason: 'holiday' })).status).toBe(400);
    expect((await send('POST', '/admin/leave-alerts/1/confirm', { ...leave, from: '3 March' })).status).toBe(400);
    expect((await send('POST', '/admin/leave-alerts/1/confirm', { ...leave, sourceUrl: undefined })).status).toBe(400);
  });

  it('dismisses with an optional note', async () => {
    expect((await send('POST', '/admin/leave-alerts/3/dismiss', { note: 'No public reason found.' })).body.data).toEqual({ dismissed: true });
    expect(leaveWatch.dismissLeave).toHaveBeenLastCalledWith(3, 'No public reason found.', 'admin@example.test');
    expect((await send('POST', '/admin/leave-alerts/3/dismiss', {})).status).toBe(200);
    expect(leaveWatch.dismissLeave).toHaveBeenLastCalledWith(3, null, 'admin@example.test');
    expect((await send('POST', '/admin/leave-alerts/409/dismiss', {})).status).toBe(409);
  });
});

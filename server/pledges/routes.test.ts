/**
 * The pledge HTTP layer: guards, validation, envelope and error mapping. The repository is
 * stubbed; its SQL is covered by pledges.integration.test.ts.
 *
 * The guard that matters most: writes need a signed-in HUMAN admin. The job secret that
 * cron uses is refused, because setting a pledge's status is an editorial act.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.ADMIN_API_SECRET = 'job-secret';
process.env.ADMIN_EMAILS = '';
process.env.LOG_LEVEL = 'silent';

const state = vi.hoisted(() => ({ calls: [] as Array<{ fn: string; args: unknown[] }>, logged: [] as string[] }));

// Real guards, scripted identity: a bearer token maps straight to a user.
vi.mock('../auth/supabase', () => ({
  supabase: {
    auth: {
      getUser: async (token: string) => {
        if (token === 'admin-token') return { data: { user: { id: 'admin-1', email: 'a@x.ie', app_metadata: { role: 'admin' }, user_metadata: {} } }, error: null };
        if (token === 'user-token') return { data: { user: { id: 'user-1', email: 'u@x.ie', app_metadata: {}, user_metadata: {} } }, error: null };
        return { data: { user: null }, error: new Error('bad token') };
      },
    },
  },
  supabaseAdmin: {},
}));

vi.mock('./repository', () => {
  const record =
    (fn: string, result: (...args: unknown[]) => unknown) =>
    async (...args: unknown[]) => {
      state.calls.push({ fn, args });
      return result(...args);
    };
  const pledge = { id: 1, party: 'Party X', title: 't', status: 'unassessed', evidenceCount: 0 };
  class UnknownDivisionError extends Error {}
  return {
    UnknownDivisionError,
    listPledges: record('listPledges', () => [pledge]),
    pledgeWithEvidence: record('pledgeWithEvidence', (id) => (id === 1 ? { ...pledge, evidence: [] } : null)),
    createPledge: record('createPledge', (input) => ((input as { title: string }).title === 'duplicate' ? null : pledge)),
    updatePledge: record('updatePledge', (id) => (id === 1 ? pledge : null)),
    deletePledge: record('deletePledge', (id) => id === 1),
    addEvidence: record('addEvidence', (input) => {
      const { pledgeId, divisionId } = input as { pledgeId: number; divisionId: string | null };
      if (divisionId === 'no-such-vote') throw new UnknownDivisionError('No recorded Dáil vote has id no-such-vote');
      return pledgeId === 1 ? { id: 9 } : null;
    }),
    deleteEvidence: record('deleteEvidence', () => true),
    allPriorityRows: record('allPriorityRows', () => [
      { userId: 'someone', category: 'housing', rank: 1 },
      { userId: 'user-1', category: 'health', rank: 1 },
    ]),
    userRanking: record('userRanking', (userId) => (userId === 'user-1' ? ['health'] : null)),
    saveRanking: record('saveRanking', () => undefined),
  };
});

const { pledgesRouter } = await import('./routes');

let server: Server;
let base: string;

beforeEach(async () => {
  state.calls = [];
  const app = express();
  app.use(express.json());
  app.use('/api/pledges', pledgesRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterEach(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const send = (path: string, init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}) =>
  fetch(base + path, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      connection: 'close',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

const validPledge = {
  party: 'Party X',
  title: 'Build homes',
  description: 'Build many homes.',
  category: 'housing',
  electionYear: 2024,
  sourceUrl: 'https://party.ie/manifesto',
};

describe('pledge write guards', () => {
  const writes: Array<[string, string, unknown]> = [
    ['POST', '/api/pledges', validPledge],
    ['PATCH', '/api/pledges/1', { status: 'delivered' }],
    ['DELETE', '/api/pledges/1', undefined],
    ['POST', '/api/pledges/1/evidence', { kind: 'other', summary: 'x happened', occurredOn: '2025-01-01', sourceUrl: 'https://x.ie' }],
    ['DELETE', '/api/pledges/evidence/9', undefined],
  ];

  for (const [method, path, body] of writes) {
    it(`${method} ${path}: 401 anonymous, 403 for a plain user, 401 for the job secret, allowed for an admin`, async () => {
      expect((await send(path, { method, body })).status).toBe(401);
      expect((await send(path, { method, body, token: 'user-token' })).status).toBe(403);
      expect((await send(path, { method, body, headers: { 'x-admin-secret': 'job-secret' } })).status).toBe(401);
      expect((await send(path, { method, body, token: 'admin-token' })).status).toBeLessThan(300);
    });
  }
});

describe('pledge validation and errors', () => {
  it('requires an http(s) source link', async () => {
    for (const sourceUrl of ['', 'not a url', 'javascript:alert(1)', 'ftp://x.ie/a']) {
      const res = await send('/api/pledges', { method: 'POST', token: 'admin-token', body: { ...validPledge, sourceUrl } });
      expect(res.status, sourceUrl).toBe(400);
    }
    expect(state.calls.filter((c) => c.fn === 'createPledge')).toHaveLength(0);
  });

  it('rejects an unknown category or status', async () => {
    expect((await send('/api/pledges', { method: 'POST', token: 'admin-token', body: { ...validPledge, category: 'vibes' } })).status).toBe(400);
    expect((await send('/api/pledges/1', { method: 'PATCH', token: 'admin-token', body: { status: 'kinda' } })).status).toBe(400);
    expect((await send('/api/pledges/1', { method: 'PATCH', token: 'admin-token', body: {} })).status).toBe(400);
  });

  it('answers 409 for a duplicate pledge and 404 for a missing one', async () => {
    const dup = await send('/api/pledges', { method: 'POST', token: 'admin-token', body: { ...validPledge, title: 'duplicate' } });
    expect(dup.status).toBe(409);
    expect((await send('/api/pledges/2')).status).toBe(404);
    expect((await send('/api/pledges/2', { method: 'PATCH', token: 'admin-token', body: { status: 'broken' } })).status).toBe(404);
    expect((await send('/api/pledges/2/evidence', { method: 'POST', token: 'admin-token', body: { kind: 'other', summary: 'xyz', occurredOn: '2025-01-01', sourceUrl: 'https://x.ie' } })).status).toBe(404);
  });

  it('answers 400 when evidence names a Dáil vote that is not recorded', async () => {
    const evidence = { kind: 'other', summary: 'xyz', occurredOn: '2025-01-01', sourceUrl: 'https://x.ie' };
    const res = await send('/api/pledges/1/evidence', { method: 'POST', token: 'admin-token', body: { ...evidence, divisionId: 'no-such-vote' } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ success: false });
    // An empty string means "no vote", not an unknown vote id.
    expect((await send('/api/pledges/1/evidence', { method: 'POST', token: 'admin-token', body: { ...evidence, divisionId: '' } })).status).toBe(201);
    expect(state.calls.at(-1)).toMatchObject({ fn: 'addEvidence', args: [expect.objectContaining({ divisionId: null })] });
  });

  it('lets anyone read, in the success envelope', async () => {
    const res = await send('/api/pledges?party=Party%20X');
    expect(await res.json()).toMatchObject({ success: true, data: [{ id: 1 }] });
    expect(state.calls.at(-1)).toEqual({ fn: 'listPledges', args: ['Party X'] });
  });
});

describe('priorities', () => {
  it('reports everyone’s weights, and the caller’s own ranking only when signed in', async () => {
    const anon = (await (await send('/api/pledges/priorities')).json()).data;
    expect(anon).toMatchObject({ rankers: 2, mine: null });
    expect(anon.community).toEqual({ housing: 0.5, health: 0.5 });

    const mine = (await (await send('/api/pledges/priorities', { token: 'user-token' })).json()).data;
    expect(mine.mine).toEqual(['health']);
  });

  it('saves a ranking for the signed-in user only, and rejects repeats', async () => {
    expect((await send('/api/pledges/priorities', { method: 'PUT', body: { ranking: ['housing'] } })).status).toBe(401);
    expect((await send('/api/pledges/priorities', { method: 'PUT', token: 'user-token', body: { ranking: ['housing', 'housing'] } })).status).toBe(400);
    const ok = await send('/api/pledges/priorities', { method: 'PUT', token: 'user-token', body: { ranking: ['health', 'housing'], userId: 'someone-else' } });
    expect(ok.status).toBe(200);
    expect(state.calls.at(-1)).toEqual({ fn: 'saveRanking', args: ['user-1', ['health', 'housing']] });
  });
});

/**
 * The HTTP layer: validation, the `{ success, data }` envelope, and error mapping.
 * The service is stubbed; its behaviour is covered by voting.integration.test.ts.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ list: [] as Array<{ fn: string; args: unknown[] }> }));

vi.mock('../auth', () => {
  const asUser: express.RequestHandler = (req, res, next) => {
    if (req.header('x-test-user')) {
      (req as express.Request & { user: unknown }).user = {
        id: req.header('x-test-user'),
        email: null,
        role: null,
        userMetadata: { county: req.header('x-test-county') ?? ' Cork ', constituency: 42 },
      };
      return next();
    }
    res.status(401).json({ success: false, message: 'Authentication required' });
  };
  return { requireAuth: asUser, optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next() };
});

vi.mock('../middleware/rateLimit', () => ({
  publicWriteRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('./service', async () => {
  class VotingError extends Error {
    constructor(
      readonly status: 400 | 404 | 409,
      message: string,
    ) {
      super(message);
    }
  }
  const record =
    (fn: string, result: (...args: unknown[]) => unknown) =>
    async (...args: unknown[]) => {
      calls.list.push({ fn, args });
      return result(...args);
    };
  return {
    VotingError,
    getOrCreateSession: record('getOrCreateSession', () => ({ sessionId: 1, items: [] })),
    recordSessionVote: record('recordSessionVote', (_u, itemId) => {
      if (itemId === 404) throw new VotingError(404, 'Session item not found');
      if (itemId === 500) throw new Error('database exploded: password=hunter2');
      return { sessionId: 1 };
    }),
    completeSession: record('completeSession', () => ({ streakCount: 2 })),
    articleVoteView: record('articleVoteView', () => ({ question: null, tally: { total: 0, byOption: {} }, myVote: null })),
    castArticleVote: record('castArticleVote', () => ({ tally: { total: 1, byOption: { option_a: 1 } }, myVote: 'option_a' })),
  };
});

const { dailySessionRouter, votesRouter } = await import('./routes');

let server: Server;
let base: string;

beforeEach(async () => {
  calls.list = [];
  const app = express();
  app.use(express.json());
  app.use('/api/daily-session', dailySessionRouter);
  app.use('/api/votes', votesRouter);
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

const send = (path: string, init: { method?: string; body?: unknown; user?: string; county?: string } = {}) =>
  fetch(base + path, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      connection: 'close',
      ...(init.user ? { 'x-test-user': init.user } : {}),
      ...(init.county ? { 'x-test-county': init.county } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

describe('voting routes', () => {
  it('wraps results in the success envelope and passes location from user metadata', async () => {
    const res = await send('/api/daily-session', { user: 'u1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { sessionId: 1, items: [] } });
    // A non-string metadata value is ignored rather than passed through.
    expect(calls.list[0]!.args[0]).toEqual({ id: 'u1', county: 'Cork', constituency: null });
  });

  it('requires a signed-in user to vote, and takes identity from the token only', async () => {
    expect((await send('/api/daily-session/items/5/vote', { method: 'POST', body: { optionKey: 'option_a' } })).status).toBe(401);

    const res = await send('/api/daily-session/items/5/vote', {
      method: 'POST',
      user: 'u1',
      body: { optionKey: 'option_a', userId: 'someone-else' },
    });
    expect(res.status).toBe(200);
    expect(calls.list.at(-1)).toEqual({ fn: 'recordSessionVote', args: ['u1', 5, 'option_a'] });
  });

  it('rejects an option key outside option_a..option_d and a non-numeric id with 400', async () => {
    const bad = await send('/api/votes/questions/3', { method: 'POST', user: 'u1', body: { optionKey: 'option_z' } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).success).toBe(false);
    expect((await send('/api/votes/questions/abc', { method: 'POST', user: 'u1', body: { optionKey: 'option_a' } })).status).toBe(400);
    expect(calls.list).toEqual([]);
  });

  it('maps a VotingError to its status and hides unexpected errors behind a 500', async () => {
    const missing = await send('/api/daily-session/items/404/vote', { method: 'POST', user: 'u1', body: { optionKey: 'option_a' } });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND', message: 'Session item not found' } });

    vi.spyOn(console, 'error').mockImplementation(() => {});
    const crashed = await send('/api/daily-session/items/500/vote', { method: 'POST', user: 'u1', body: { optionKey: 'option_a' } });
    expect(crashed.status).toBe(500);
    expect(JSON.stringify(await crashed.json())).not.toContain('hunter2');
  });

  it('lets anyone read an article’s question, passing the viewer only when signed in', async () => {
    const res = await send('/api/votes/articles/9');
    expect(res.status).toBe(200);
    expect(calls.list.at(-1)).toEqual({ fn: 'articleVoteView', args: [9, null] });
  });

  it('drops a county longer than its column instead of failing the insert', async () => {
    expect((await send('/api/daily-session', { user: 'u1', county: 'x'.repeat(61) })).status).toBe(200);
    expect(calls.list[0]!.args[0]).toEqual({ id: 'u1', county: null, constituency: null });
  });
});

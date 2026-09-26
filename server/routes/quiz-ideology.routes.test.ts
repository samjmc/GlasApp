/**
 * The HTTP layer of /api/quiz and /api/ideology: validation, auth, the `{ success, data }`
 * envelope and error mapping. The domain services are stubbed; their maths is unit-tested
 * in server/quiz and server/ideology.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ list: [] as Array<{ fn: string; args: unknown[] }> }));

vi.mock('../auth', () => {
  const asUser: express.RequestHandler = (req, res, next) => {
    if (req.header('x-test-user')) {
      (req as express.Request & { user: unknown }).user = { id: req.header('x-test-user') };
      return next();
    }
    res.status(401).json({ success: false, message: 'Authentication required' });
  };
  return { requireAuth: asUser };
});

vi.mock('../middleware/rateLimit', () => ({
  aiRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/aiService', () => ({
  callChatCompletion: vi.fn(async () => ({ choices: [{ message: { content: 'It means X.' } }] })),
}));

const vector = { economic: 1, social: 2, cultural: 3, authority: 4, environmental: -1, welfare: -2, globalism: -3, technocratic: -4 };

vi.mock('../quiz', async () => {
  const { QuizInputError } = await import('../quiz/score');
  return {
    QuizInputError,
    submitQuiz: vi.fn(async (userId: string | null, answers: Array<{ questionId: number }>) => {
      calls.list.push({ fn: 'submitQuiz', args: [userId, answers] });
      if (answers[0]!.questionId === 999) throw new QuizInputError('Unknown question 999');
      return { id: userId ? 7 : null, vector, ideology: 'Centrist', description: 'd', answeredCount: answers.length, createdAt: null };
    }),
    quizHistory: vi.fn(async (userId: string) => {
      calls.list.push({ fn: 'quizHistory', args: [userId] });
      return [];
    }),
  };
});

vi.mock('../ideology', () => ({
  getIdeologyProfile: vi.fn(async (userId: string) => (userId === 'new-user' ? null : vector)),
  matchesFor: vi.fn(async (v: unknown, weights: unknown) => {
    calls.list.push({ fn: 'matchesFor', args: [v, weights] });
    return { tds: [], parties: [] };
  }),
  userMatches: vi.fn(async (userId: string, weights: unknown, options: unknown) => {
    calls.list.push({ fn: 'userMatches', args: [userId, weights, options] });
    if (userId === 'new-user') return null;
    const issues = { agree: 1, disagree: 0, items: [{ questionId: 3, question: 'Q?', domain: 'housing', yours: 'Build', theirs: 'Build', agrees: true, quote: 'q', quoteKind: 'direct', outlet: 'RTÉ', url: 'https://x', statedAt: '2026-09-20T00:00:00.000Z' }] };
    return { tds: [{ tdId: 7, name: 'A', alignment: 81, issues }], parties: [], measured: ['economic', 'welfare'] };
  }),
  userTimeline: vi.fn(async () => [{ date: '2026-09-24', vector }]),
  partyProfile: vi.fn(async (name: string) => (name === 'Fine Gael' ? { party: 'Fine Gael', vector, tdCount: 1, computedAt: null } : null)),
  tdProfile: vi.fn(async (id: number) => (id === 1 ? { td: { id: 1, name: 'A' }, profile: null } : null)),
}));

const quizRoutes = (await import('./quiz')).default;
const ideologyRoutes = (await import('./ideology')).default;

let server: Server;
let base: string;

beforeEach(async () => {
  calls.list = [];
  const app = express();
  app.use(express.json());
  // Stands in for the global optionalAuth: sets req.user when the header is present.
  app.use((req, _res, next) => {
    if (req.header('x-test-user')) (req as express.Request & { user: unknown }).user = { id: req.header('x-test-user') };
    next();
  });
  app.use('/api/quiz', quizRoutes);
  app.use('/api/ideology', ideologyRoutes);
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

const post = (path: string, body: unknown, user?: string) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close', ...(user ? { 'x-test-user': user } : {}) },
    body: JSON.stringify(body),
  });
const get = (path: string, user?: string) =>
  fetch(`${base}${path}`, { headers: { connection: 'close', ...(user ? { 'x-test-user': user } : {}) } });

describe('POST /api/quiz', () => {
  const answers = [{ questionId: 1, answerIndex: 0 }];

  it('scores an anonymous quiz without a user', async () => {
    const res = await post('/api/quiz', { answers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { id: number | null } };
    expect(body).toMatchObject({ success: true, data: { id: null } });
    expect(calls.list[0]).toEqual({ fn: 'submitQuiz', args: [null, answers] });
  });

  it('attributes the result to the token user, never to a body field', async () => {
    await post('/api/quiz', { answers, userId: 'someone-else' }, 'user-1');
    expect(calls.list[0]!.args[0]).toBe('user-1');
  });

  it('returns 400 for a malformed body and for answers the bank rejects', async () => {
    expect((await post('/api/quiz', { answers: [] })).status).toBe(400);
    expect((await post('/api/quiz', { answers: [{ questionId: 1, answerIndex: 'a' }] })).status).toBe(400);
    const res = await post('/api/quiz', { answers: [{ questionId: 999, answerIndex: 0 }] });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('Unknown question 999');
  });
});

describe('GET /api/quiz/me', () => {
  it('needs a signed-in user', async () => {
    expect((await get('/api/quiz/me')).status).toBe(401);
    const res = await get('/api/quiz/me', 'user-1');
    expect(res.status).toBe(200);
    expect(calls.list[0]).toEqual({ fn: 'quizHistory', args: ['user-1'] });
  });
});

describe('POST /api/quiz/assistant', () => {
  it('answers and validates', async () => {
    expect((await post('/api/quiz/assistant', { questionText: 'q' })).status).toBe(400);
    const res = await post('/api/quiz/assistant', { questionText: 'q', userQuestion: 'what?' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: { answer: 'It means X.' } });
  });
});

describe('/api/ideology', () => {
  it('me, timeline and matches need a signed-in user', async () => {
    for (const path of ['/api/ideology/me', '/api/ideology/me/timeline', '/api/ideology/me/matches']) {
      expect((await get(path)).status).toBe(401);
    }
  });

  it('returns the profile, and null before any quiz or vote', async () => {
    expect(await (await get('/api/ideology/me', 'user-1')).json()).toMatchObject({ data: { vector } });
    expect(await (await get('/api/ideology/me', 'new-user')).json()).toMatchObject({ data: { vector: null } });
  });

  it('returns no matches for a user with no profile, and parses weights', async () => {
    const empty = await (await get('/api/ideology/me/matches', 'new-user')).json();
    expect(empty).toMatchObject({ data: { tds: [], parties: [] }, meta: { hasProfile: false, measured: [] } });
    const full = await (await get('/api/ideology/me/matches?weights=economic:2,welfare:0.5,bogus:9', 'user-1')).json();
    expect(calls.list.at(-1)).toEqual({ fn: 'userMatches', args: ['user-1', { economic: 2, welfare: 0.5 }, {}] });
    expect(full).toMatchObject({ meta: { hasProfile: true, measured: ['economic', 'welfare'] } });
    expect(full.data).not.toHaveProperty('measured');
  });

  it('passes the TD asked about through, and returns each match with its shared issues', async () => {
    const body = await (await get('/api/ideology/me/matches?td=7', 'user-1')).json();
    expect(calls.list.at(-1)).toEqual({ fn: 'userMatches', args: ['user-1', {}, { tdId: 7 }] });
    expect(body.data.tds[0]).toMatchObject({ tdId: 7, alignment: 81, issues: { agree: 1, disagree: 0 } });
    expect(body.data.tds[0].issues.items[0]).toMatchObject({ questionId: 3, yours: 'Build', theirs: 'Build', agrees: true, outlet: 'RTÉ' });
    // A malformed td is ignored rather than rejected: the matches are still the user's.
    await get('/api/ideology/me/matches?td=abc', 'user-1');
    expect(calls.list.at(-1)!.args[2]).toEqual({});
  });

  it('includes a party to compare on the timeline', async () => {
    const body = (await (await get('/api/ideology/me/timeline?party=Fine%20Gael', 'user-1')).json()) as { data: { points: unknown[]; party: { party: string } } };
    expect(body.data.points).toHaveLength(1);
    expect(body.data.party.party).toBe('Fine Gael');
  });

  it('POST /matches is public and validates the position', async () => {
    expect((await post('/api/ideology/matches', { vector })).status).toBe(200);
    expect((await post('/api/ideology/matches', { vector: { ...vector, welfare: 11 } })).status).toBe(400);
    expect((await post('/api/ideology/matches', { vector: { economic: 1 } })).status).toBe(400);
    expect((await post('/api/ideology/matches', { vector, weights: { economic: 4 } })).status).toBe(400);
  });

  it('TD and party lookups 404 when unknown and 400 on a bad id', async () => {
    expect((await get('/api/ideology/td/1')).status).toBe(200);
    expect((await get('/api/ideology/td/2')).status).toBe(404);
    expect((await get('/api/ideology/td/abc')).status).toBe(400);
    expect((await get('/api/ideology/party/Fine%20Gael')).status).toBe(200);
    expect((await get('/api/ideology/party/Nobody')).status).toBe(404);
  });
});

/**
 * /api/news-feed without a database: the region gate, the query and paging handed to the
 * repository, each card's policy question, the TD feed, and a failure's answer. Mounted behind
 * regionMiddleware as server/routes.ts mounts it. The SQL is covered by feedQueries.integration.test.ts.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.LOG_LEVEL = 'silent';

const state = vi.hoisted(() => ({ calls: [] as Array<[string, ...unknown[]]>, total: 25, fail: false }));

const row = (id: number) => ({
  id,
  title: `Story ${id}`,
  summary: null,
  aiSummary: null,
  category: null,
  url: `https://news.example/${id}`,
  imageUrl: null,
  publishedAt: new Date('2026-11-04T09:00:00Z'),
  source: 'RTÉ',
  sourceLogoUrl: null,
  affectedTds: [{ name: 'A. TD' }],
  alsoReportedBy: [],
});

vi.mock('../db', () => ({ db: {} }));
vi.mock('../news/repository', () => ({
  feedPage: vi.fn(async (...args: unknown[]) => {
    state.calls.push(['feedPage', ...args]);
    if (state.fail) throw new Error('relation "news_articles" does not exist');
    return { rows: [row(1), row(2)], total: state.total };
  }),
  feedForTd: vi.fn(async (...args: unknown[]) => {
    state.calls.push(['feedForTd', ...args]);
    return [row(3)];
  }),
}));
vi.mock('../voting', () => ({
  getQuestionsForArticles: vi.fn(async (ids: number[]) => {
    state.calls.push(['getQuestionsForArticles', ids]);
    return new Map([[2, { questionId: 7, question: 'Should it?' }]]);
  }),
}));

let server: Server;
let base: string;

beforeAll(async () => {
  const { default: newsRoutes } = await import('./news');
  const { regionMiddleware } = await import('../middleware/regionMiddleware');
  const { errorHandler } = await import('../middleware/errorHandler');
  const app = express();
  app.use('/api/news-feed', regionMiddleware, newsRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/news-feed`;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  state.calls = [];
  state.total = 25;
  state.fail = false;
});

const get = async (pathname: string, headers: Record<string, string> = {}) => {
  const res = await fetch(base + pathname, { headers: { connection: 'close', ...headers } });
  return { status: res.status, body: await res.json() };
};

describe('GET /api/news-feed', () => {
  it('pages the Irish feed with the parsed query, and puts each article’s question on its card', async () => {
    const { status, body } = await get('/?sort=recent&limit=2&offset=20');
    expect(status).toBe(200);
    expect(state.calls[0]).toEqual(['feedPage', { sort: 'recent', limit: 2, offset: 20 }, { since: expect.any(Date), fallbackDays: 30 }]);
    expect(state.calls[1]).toEqual(['getQuestionsForArticles', [1, 2]]);
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(25);
    expect(body.data.hasMore).toBe(true);
    expect(body.data.articles.map((a: { id: number; policyVote: unknown }) => [a.id, a.policyVote])).toEqual([
      [1, null],
      [2, { questionId: 7, question: 'Should it?' }],
    ]);
    expect(body.data.articles[0]).toMatchObject({ source: 'RTÉ', publishedAt: '2026-11-04T09:00:00.000Z', affectedTDs: [{ name: 'A. TD' }] });
  });

  it('says there is no more once the page reaches the total', async () => {
    state.total = 22;
    expect((await get('/?sort=recent&limit=2&offset=20')).body.data.hasMore).toBe(false);
  });

  it('answers another region with an empty feed and reads nothing: only Irish news is ingested', async () => {
    for (const headers of [{ 'x-region-code': 'UK' }, { cookie: 'glas_region=US' }]) {
      const { status, body } = await get('/', headers);
      expect(status).toBe(200);
      expect(body).toEqual({ success: true, data: { articles: [], total: 0, hasMore: false } });
    }
    expect(state.calls).toEqual([]);
  });

  it('answers a database failure with a 500 that does not carry the database error', async () => {
    state.fail = true;
    const { status, body } = await get('/');
    expect(status).toBe(500);
    expect(body).toEqual({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  });
});

describe('GET /api/news-feed/td/:name', () => {
  it('reads the 20 latest articles naming the TD, with their questions', async () => {
    const { status, body } = await get('/td/Mary%20Lou%20McDonald');
    expect(status).toBe(200);
    expect(state.calls[0]).toEqual(['feedForTd', 'Mary Lou McDonald', 20]);
    expect(body.data.articles.map((a: { id: number }) => a.id)).toEqual([3]);
  });
});

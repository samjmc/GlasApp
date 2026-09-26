/**
 * GET /api/stances/td/:id over HTTP: validation, 404, the envelope, and the grouping with
 * "said N times" and "changed position". The repository is stubbed; its SQL is covered by
 * stances.integration.test.ts.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TdStanceRow } from '@shared/schema/stances';
import type { TdStances } from '@shared/stancesApi';

const rows = vi.hoisted(() => ({ byTd: new Map<number, unknown[]>() }));

vi.mock('./repository', () => ({
  tdExists: vi.fn(async (id: number) => rows.byTd.has(id)),
  stancesForTd: vi.fn(async (id: number) => rows.byTd.get(id) ?? []),
}));

const { stancesRouter } = await import('./routes');

const stance = (over: Partial<TdStanceRow>): TdStanceRow => ({
  id: 1,
  tdId: 7,
  articleId: 100,
  questionId: 10,
  optionKey: 'option_a',
  quote: 'We will build fifty thousand homes a year and we will do it in public hands.',
  quoteKind: 'direct',
  policyDomain: 'housing',
  optionText: 'Build public homes',
  statedAt: new Date('2026-09-20T09:00:00Z'),
  articleUrl: 'https://www.rte.ie/news/1',
  sourceName: 'RTÉ News',
  headline: 'Housing plan',
  createdAt: new Date('2026-09-20T10:00:00Z'),
  ...over,
});

let server: Server;
let base: string;

beforeEach(async () => {
  rows.byTd.clear();
  const app = express();
  app.use('/api/stances', stancesRouter);
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

const get = (path: string) => fetch(`${base}${path}`, { headers: { connection: 'close' } });

describe('GET /api/stances/td/:id', () => {
  it('400 on a bad id, 404 for an unknown TD', async () => {
    expect((await get('/api/stances/td/abc')).status).toBe(400);
    expect((await get('/api/stances/td/0')).status).toBe(400);
    const res = await get('/api/stances/td/99');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('a TD with no stances is an empty list, not a 404', async () => {
    rows.byTd.set(7, []);
    expect(await (await get('/api/stances/td/7')).json()).toEqual({ success: true, data: { tdId: 7, domains: [] } });
  });

  it('groups by domain, newest first, with "said N times" and "changed position"', async () => {
    rows.byTd.set(7, [
      // Newest first, as the repository returns them.
      stance({ id: 3, questionId: 10, optionKey: 'option_b', optionText: 'Leave it to the market', statedAt: new Date('2026-09-22T09:00:00Z') }),
      stance({ id: 2, questionId: null, policyDomain: 'health', quoteKind: 'paraphrase', optionKey: null, optionText: null, statedAt: new Date('2026-09-21T09:00:00Z') }),
      stance({ id: 1, questionId: 10, statedAt: new Date('2026-09-20T09:00:00Z') }),
      stance({ id: 4, questionId: null, optionKey: null, optionText: null, statedAt: new Date('2026-09-19T09:00:00Z') }),
    ]);
    const body = (await (await get('/api/stances/td/7')).json()) as { success: boolean; data: TdStances };
    expect(body.success).toBe(true);
    expect(body.data.domains.map((d) => d.domain)).toEqual(['housing', 'health']);
    const housing = body.data.domains[0]!.stances;
    expect(housing.map((s) => s.id)).toEqual([3, 1, 4]);
    expect(housing[0]).toEqual({
      id: 3,
      quote: 'We will build fifty thousand homes a year and we will do it in public hands.',
      quoteKind: 'direct',
      outlet: 'RTÉ News',
      url: 'https://www.rte.ie/news/1',
      headline: 'Housing plan',
      statedAt: '2026-09-22T09:00:00.000Z',
      questionId: 10,
      optionText: 'Leave it to the market',
      saidCount: 2,
      changedPosition: true,
    });
    expect(housing[1]).toMatchObject({ saidCount: 2, changedPosition: true });
    // No question: said once, never "changed".
    expect(housing[2]).toMatchObject({ questionId: null, saidCount: 1, changedPosition: false });
    // A quote with no clear answer is on record, but is not a position on any question.
    expect(body.data.domains[1]!.stances[0]).toMatchObject({ quoteKind: 'paraphrase', questionId: null, optionText: null, saidCount: 1, changedPosition: false });
  });

  it('the same answer twice is said twice, not a change', async () => {
    rows.byTd.set(7, [stance({ id: 2, statedAt: new Date('2026-09-22T09:00:00Z') }), stance({ id: 1 })]);
    const body = (await (await get('/api/stances/td/7')).json()) as { data: TdStances };
    expect(body.data.domains[0]!.stances.map((s) => [s.saidCount, s.changedPosition])).toEqual([
      [2, false],
      [2, false],
    ]);
  });
});

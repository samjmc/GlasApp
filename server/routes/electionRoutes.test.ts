/**
 * /api/elections results routes: each result query filters on the election AND the
 * constituency (or party). A second drizzle `.where()` replaces the first, so chaining two
 * of them silently dropped the election filter and mixed every election's results.
 */
import type { Server } from 'node:http';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Each db.select() records its .where() arguments and resolves to the next queued rows.
const { state } = vi.hoisted(() => {
  const state = {
    queue: [] as unknown[][],
    wheres: [] as unknown[][],
    select() {
      const wheres: unknown[] = [];
      state.wheres.push(wheres);
      const rows = state.queue.shift() ?? [];
      const query: Record<string, unknown> = {
        from: () => query,
        innerJoin: () => query,
        orderBy: () => query,
        where: (condition: unknown) => {
          wheres.push(condition);
          return query;
        },
        then: (resolve: (v: unknown[]) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      };
      return query;
    },
  };
  return { state };
});

vi.mock('../db', () => ({ db: { select: () => state.select() }, pool: {}, supabaseDb: null, shutdown: vi.fn(), checkDatabaseConnection: vi.fn() }));
vi.mock('../services/cacheService', () => ({
  cached: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  TTL: { ONE_DAY: 86400000, ONE_WEEK: 604800000 },
}));

const electionRoutes = (await import('./electionRoutes')).default;
const dialect = new PgDialect();

async function get(path: string): Promise<number> {
  const app = express();
  app.use('/api/elections', electionRoutes);
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { connection: 'close' } });
    return res.status;
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** The one WHERE of the results query (the third select), rendered to SQL. */
function resultsWhere() {
  expect(state.wheres).toHaveLength(3);
  expect(state.wheres[2]).toHaveLength(1);
  return dialect.sqlToQuery(state.wheres[2][0] as SQL);
}

const election = { id: 7, name: 'General Election 2024', date: new Date('2024-11-29') };

beforeEach(() => {
  state.queue = [];
  state.wheres = [];
});

describe('electionRoutes', () => {
  it('filters constituency results on the election and the constituency', async () => {
    state.queue = [[election], [{ id: 12, name: 'Dublin Central', seats: 4 }], []];
    expect(await get('/api/elections/7/constituency/12')).toBe(200);
    const where = resultsWhere();
    expect(where.sql).toContain('"election_results"."election_id" = $1');
    expect(where.sql).toContain('"election_results"."constituency_id" = $2');
    expect(where.params).toEqual([7, 12]);
  });

  it('filters party results on the election and the party', async () => {
    state.queue = [[election], [{ id: 3, name: 'Fine Gael', color: '#0000ff' }], []];
    expect(await get('/api/elections/7/party/3')).toBe(200);
    const where = resultsWhere();
    expect(where.sql).toContain('"election_results"."election_id" = $1');
    expect(where.sql).toContain('"election_results"."party_id" = $2');
    expect(where.params).toEqual([7, 3]);
  });
});

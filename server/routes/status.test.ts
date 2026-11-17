/**
 * GET /api/status: public, so it must carry only what the uptime check reads (database size, and when
 * each job last ran and whether it worked) and never a job's counts or error text.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  db: { execute: vi.fn(async () => ({ rows: [{ bytes: '260046848' }] })) },
}));
vi.mock('../services/jobRuns', () => ({
  recentJobRuns: vi.fn(async () => ({
    'parliament-sync': [
      { id: 7, job: 'parliament-sync', startedAt: new Date('2026-11-18T04:45:00Z'), finishedAt: new Date('2026-11-18T04:52:00Z'), ok: true, summary: { days: 3 }, error: null },
    ],
    'news-ingest': [
      { id: 9, job: 'news-ingest', startedAt: new Date('2026-11-18T07:30:00Z'), finishedAt: null, ok: null, summary: null, error: 'secret detail' },
    ],
  })),
}));

const statusRoutes = (await import('./status')).default;

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/status', statusRoutes);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /api/status', () => {
  it('gives the database size and each job\'s last run, and nothing else about the run', async () => {
    const res = await fetch(`${base}/api/status`, { headers: { connection: 'close' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        databaseBytes: 260046848,
        jobs: {
          'parliament-sync': { startedAt: '2026-11-18T04:45:00.000Z', finishedAt: '2026-11-18T04:52:00.000Z', ok: true },
          'news-ingest': { startedAt: '2026-11-18T07:30:00.000Z', finishedAt: null, ok: null },
        },
      },
    });
  });
});

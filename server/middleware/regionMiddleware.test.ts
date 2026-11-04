/**
 * The region is resolved only for the news feed, its one reader (A23). Before, it ran on every
 * request and put a Set-Cookie on every page, asset and API response.
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.LOG_LEVEL = 'silent';

vi.mock('../db', () => ({ pool: null, db: {}, shutdown: vi.fn(), checkDatabaseConnection: vi.fn(async () => true) }));

const { registerRoutes } = await import('../routes');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  server = (await registerRoutes(app)).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('regionMiddleware mount', () => {
  it('resolves the region for the news feed and remembers it in the cookie', async () => {
    const res = await fetch(`${base}/api/news-feed`, { headers: { 'x-region-code': 'uk' } });
    expect(res.status).toBe(200);
    // A preview region gets an empty feed without touching the database.
    expect(await res.json()).toMatchObject({ success: true, data: { articles: [], total: 0 } });
    expect(res.headers.get('set-cookie')).toMatch(/^glas_region=UK;/);
  });

  it('sets no region cookie on other responses', async () => {
    const res = await fetch(`${base}/api/no-such-route`, { headers: { 'x-region-code': 'UK' } });
    expect(res.status).toBe(404);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});

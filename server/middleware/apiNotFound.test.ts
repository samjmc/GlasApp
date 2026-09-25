/**
 * An unknown /api path must be a JSON 404 even when an SPA catch-all is mounted after it.
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiNotFound } from './apiNotFound';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.get('/api/real', (_req, res) => res.json({ ok: true }));
  app.use('/api', apiNotFound);
  // Stands in for the Vite / static index.html fallback.
  app.use('*', (_req, res) => res.type('html').send('<!DOCTYPE html>'));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('apiNotFound', () => {
  it.each(['GET', 'POST'])('returns a JSON 404 for an unknown %s /api path', async (method) => {
    const res = await fetch(`${base}/api/contact?x=1`, { method });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(body.error.message).toBe(`No API route for ${method} /api/contact`);
  });

  it('leaves real API routes and page routes alone', async () => {
    expect(await (await fetch(`${base}/api/real`)).json()).toEqual({ ok: true });
    const page = await fetch(`${base}/rankings`);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe('<!DOCTYPE html>');
  });
});

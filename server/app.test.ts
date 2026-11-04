/**
 * A rejected async route handler must reach the error handler as a 500. Under Express 4 it was an
 * unhandled rejection: no response, and server/index.ts exits the process on those.
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMiddleware } from './app';
import { errorHandler } from './middleware/errorHandler';

let server: Server;
let base: string;
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

beforeAll(async () => {
  process.on('unhandledRejection', onUnhandled);
  const app = express();
  applyMiddleware(app);
  // A bare async function, as every route is written: Express 5 has to catch its rejection.
  app.get('/boom', async () => {
    await Promise.resolve();
    throw new Error('boom');
  });
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  process.off('unhandledRejection', onUnhandled);
  await new Promise<void>((r) => server.close(() => r()));
});

describe('the app middleware with the error handler', () => {
  it('answers a throwing async route with a JSON 500 and keeps serving', async () => {
    // Express 4 never answered: this request hung until the abort.
    const res = await fetch(`${base}/boom`, { signal: AbortSignal.timeout(2000) });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'INTERNAL_ERROR' } });

    expect((await fetch(`${base}/boom`, { signal: AbortSignal.timeout(2000) })).status).toBe(500);
    expect(await (await fetch(`${base}/ok`)).json()).toEqual({ ok: true });
    expect(unhandled).toEqual([]);
  });
});

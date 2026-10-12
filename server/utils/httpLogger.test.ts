import type { Server } from 'node:http';
import { Writable } from 'node:stream';
import express from 'express';
import pino from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpLogger } from './httpLogger';

let server: Server | undefined;
afterEach(async () => {
  server?.closeAllConnections?.();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

async function serve() {
  const lines: Array<Record<string, any>> = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(JSON.parse(String(chunk)));
      done();
    },
  });
  const app = express();
  app.use(createHttpLogger(pino({ level: 'info' }, stream)));
  app.get('/health', (_req, res) => void res.json({ status: 'ok' }));
  app.get('/auth/reset-password', (_req, res) => void res.send('page'));
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  return { lines, base: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}` };
}

describe('the request log', () => {
  it('logs the path, not the query or the headers: a reset or OAuth link carries a one-time credential in the query', async () => {
    const { lines, base } = await serve();
    await fetch(`${base}/auth/reset-password?token_hash=SECRET-RESET-HASH&type=recovery`, {
      headers: { 'user-agent': 'a-very-identifying-browser/1.0', cookie: 'a=b', connection: 'close' },
    });
    await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));

    const line = lines[0]!;
    expect(line.req).toEqual({ id: expect.anything(), method: 'GET', url: '/auth/reset-password', remoteAddress: expect.any(String) });
    expect(line.route).toBe('GET /auth/reset-password');
    expect(line.res.statusCode).toBe(200);
    const text = JSON.stringify(lines);
    for (const secret of ['SECRET-RESET-HASH', 'type=recovery', 'a-very-identifying-browser']) expect(text).not.toContain(secret);
  });

  it('does not log health probes at all', async () => {
    const { lines, base } = await serve();
    await fetch(`${base}/health`, { headers: { connection: 'close' } });
    await fetch(`${base}/auth/reset-password`, { headers: { connection: 'close' } });
    await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));
    expect(lines.map((l) => l.route)).toEqual(['GET /auth/reset-password']);
  });
});

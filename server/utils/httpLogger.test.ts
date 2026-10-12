import type { Server } from 'node:http';
import { Writable } from 'node:stream';
import express from 'express';
import pino from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpLogger } from './httpLogger';
import { serializeError } from './logger';

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
  // The root logger the server uses has the error serialiser; the request logger must not undo it.
  app.use(createHttpLogger(pino({ level: 'info', serializers: { err: serializeError } }, stream)));
  // What errorHandler does: log the error through the request's own logger. body-parser puts the raw request text on `body`.
  app.get('/broken', (req, res) => {
    req.log.error({ err: Object.assign(new SyntaxError('Unexpected end of JSON input'), { body: '{"bio":"my private words"' }) }, 'Request failed');
    res.status(500).send('no');
  });
  app.get('/health', (_req, res) => void res.json({ status: 'ok' }));
  app.get('/auth/reset-password', (_req, res) => void res.send('page'));
  // The HTTPS redirect in index.ts copies the request's query string into Location.
  app.get('/moved', (req, res) => void res.redirect(301, `/auth/reset-password?${req.url.split('?')[1] ?? ''}`));
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

  it('logs a response as its status only: a redirect Location can carry the same query, and a Set-Cookie is a credential', async () => {
    const { lines, base } = await serve();
    await fetch(`${base}/moved?token_hash=SECRET-REDIRECTED`, { redirect: 'manual', headers: { connection: 'close', 'x-admin-secret': 'job-secret-value' } });
    await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));
    expect(lines[0]!.res).toEqual({ statusCode: 301 });
    const text = JSON.stringify(lines);
    for (const secret of ['SECRET-REDIRECTED', 'job-secret-value', 'location']) expect(text).not.toContain(secret);
  });

  it('an error logged through req.log keeps its message and stack but not the raw request text body-parser put on it', async () => {
    const { lines, base } = await serve();
    await fetch(`${base}/broken`, { headers: { connection: 'close' } });
    await vi.waitFor(() => expect(lines.some((l) => l.msg === 'Request failed')).toBe(true));
    const failed = lines.find((l) => l.msg === 'Request failed')!;
    expect(failed.err).toMatchObject({ type: 'SyntaxError', message: 'Unexpected end of JSON input' });
    expect(JSON.stringify(lines)).not.toContain('my private words');
  });

  it('does not log health probes at all', async () => {
    const { lines, base } = await serve();
    await fetch(`${base}/health`, { headers: { connection: 'close' } });
    await fetch(`${base}/auth/reset-password`, { headers: { connection: 'close' } });
    await vi.waitFor(() => expect(lines.length).toBeGreaterThan(0));
    expect(lines.map((l) => l.route)).toEqual(['GET /auth/reset-password']);
  });
});

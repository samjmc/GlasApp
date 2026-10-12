/**
 * A request log line must not hold the visitor's IP address or browser, or credentials.
 * Runs the real redact paths through pino-http, which is what writes the line in production.
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Writable } from 'node:stream';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOG_REDACT, logRequest } from './logger';

const lines: Record<string, any>[] = [];
let server: Server;
let base: string;

beforeAll(async () => {
  const sink = new Writable({
    write(chunk, _enc, done) {
      for (const line of chunk.toString().split('\n').filter(Boolean)) lines.push(JSON.parse(line));
      done();
    },
  });
  const app = express();
  app.use(pinoHttp({ logger: pino({ redact: LOG_REDACT }, sink), serializers: { req: logRequest } }));
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('request log redaction', () => {
  it('blanks the IP address, user agent, cookie, authorization header and query string', async () => {
    // The reset-password link arrives as /auth/reset-password?token_hash=...: never log the token.
    const res = await fetch(`${base}/ping?token_hash=one-time-token-123&type=recovery`, {
      headers: {
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'TestBrowser/1.0',
        cookie: 'a=b',
        authorization: 'Bearer secret-token',
      },
    });
    expect(res.status).toBe(200);
    // The line is written when the response finishes, a moment after fetch resolves.
    await new Promise((r) => setTimeout(r, 50));

    const requestLines = lines.filter((l) => l.req);
    expect(requestLines).toHaveLength(1);
    const { req } = requestLines[0];
    expect(req.url).toBe('/ping');
    expect(req.headers['x-forwarded-for']).toBe('[REDACTED]');
    expect(req.headers['user-agent']).toBe('[REDACTED]');
    expect(req.headers.cookie).toBe('[REDACTED]');
    expect(req.headers.authorization).toBe('[REDACTED]');
    expect(req.remoteAddress).toBe('[REDACTED]');

    const raw = JSON.stringify(requestLines[0]);
    // (The Host header names this test server, not a visitor, so 127.0.0.1 is not checked here.)
    for (const secret of ['203.0.113.7', 'TestBrowser', 'secret-token', 'one-time-token-123']) {
      expect(raw).not.toContain(secret);
    }
  });
});

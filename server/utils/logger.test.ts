import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { afterEach, describe, expect, it } from 'vitest';
import { logRedaction, serializeError } from './logger';

describe('serializeError', () => {
  it('keeps the message, type and stack but not the raw request text body-parser attaches to a parse error', () => {
    const err = Object.assign(new SyntaxError('Unexpected token } in JSON'), { body: '{"bio":"my private words"}', status: 400 });
    const out = serializeError(err) as Record<string, unknown>;
    expect(out).toMatchObject({ type: 'SyntaxError', message: 'Unexpected token } in JSON', status: 400 });
    expect(out.stack).toEqual(expect.any(String));
    expect('body' in out).toBe(false);
    expect(JSON.stringify(out)).not.toContain('my private words');
    // The error itself is not changed.
    expect(err.body).toBe('{"bio":"my private words"}');
  });

  it('also cleans an error that is ALREADY serialised, which is what pino-http hands a custom serialiser', () => {
    const serialised = { type: 'SyntaxError', message: 'bad', stack: 'SyntaxError: bad\n    at x', body: '{"bio":"my private words"}', status: 400 };
    const out = serializeError(serialised) as Record<string, unknown>;
    expect(out).toEqual({ type: 'SyntaxError', message: 'bad', stack: 'SyntaxError: bad\n    at x', status: 400 });
    expect(serialised.body).toBe('{"bio":"my private words"}');
  });

  it('passes anything that is not an Error through unchanged (a rejection can be any value)', () => {
    const reason = { body: 'kept', code: 7 };
    expect(serializeError(reason)).toBe(reason);
    expect(reason.body).toBe('kept');
    expect(serializeError('text')).toBe('text');
  });
});

describe('request logging redaction', () => {
  let server: http.Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  it('never writes the job secret headers to the log', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    // The same redaction config on raw pino-http. The server's own request log (httpLogger.ts) drops the
    // headers altogether; this is the second line, for anything else that logs a header object.
    const log = pinoHttp({ logger: pino({ redact: logRedaction }, sink) });
    server = http.createServer((req, res) => {
      log(req, res);
      res.end('ok');
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    await fetch(`http://127.0.0.1:${port}/api/admin/job`, {
      method: 'POST',
      headers: {
        'x-admin-secret': 'admin-secret-value-123',
        'x-cron-secret': 'cron-secret-value-456',
      },
    });
    // pino-http logs on response finish, which can land just after the client has its reply.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(lines).toHaveLength(1);
    const logged = JSON.parse(lines[0]);
    expect(logged.req.headers['x-admin-secret']).toBe('[REDACTED]');
    expect(logged.req.headers['x-cron-secret']).toBe('[REDACTED]');
    expect(lines[0]).not.toContain('admin-secret-value-123');
    expect(lines[0]).not.toContain('cron-secret-value-456');
  });
});

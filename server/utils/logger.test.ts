import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { afterEach, describe, expect, it } from 'vitest';
import { logRedaction } from './logger';

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
    // Same redaction config and the same pino-http wiring the server uses.
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

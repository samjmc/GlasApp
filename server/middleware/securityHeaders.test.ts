import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { securityHeaders } from './securityHeaders';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(securityHeaders({ SUPABASE_URL: 'https://abc123.supabase.co' }));
  app.get('/page', (_req, res) => res.type('html').send('<!DOCTYPE html>'));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

/** The policy as a map of directive name to its sources. */
function directives(header: string | null): Record<string, string[]> {
  return Object.fromEntries(
    (header ?? '')
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([name, ...sources]) => [name, sources]),
  );
}

describe('securityHeaders', () => {
  it('sends the policy as Content-Security-Policy-Report-Only and does not enforce it', async () => {
    const res = await fetch(`${base}/page`);
    expect(res.headers.get('content-security-policy-report-only')).toBeTruthy();
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('allows only what the app uses, with the Supabase origin from SUPABASE_URL', async () => {
    const policy = directives((await fetch(`${base}/page`)).headers.get('content-security-policy-report-only'));
    expect(policy['default-src']).toEqual(["'self'"]);
    expect(policy['connect-src']).toEqual(["'self'", 'https://abc123.supabase.co', 'wss://abc123.supabase.co']);
    expect(policy['img-src']).toEqual(["'self'", 'https:', 'data:', 'blob:']);
    expect(policy['style-src']).toEqual(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']);
    expect(policy['script-src']).toEqual(["'self'"]);
    expect(policy['font-src']).toEqual(["'self'", 'data:', 'https://fonts.gstatic.com']);
    expect(policy['frame-ancestors']).toEqual(["'none'"]);
  });

  it('is mounted by the server, and helmet is configured nowhere else', () => {
    const src = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');
    expect(src.match(/app\.use\(securityHeaders\(\)\)/g)).toHaveLength(1);
    expect(src).not.toMatch(/helmet\s*\(/);
  });

  it('keeps the other helmet headers', async () => {
    const res = await fetch(`${base}/page`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
  });

  it('leaves connect-src at self when SUPABASE_URL is unset or not a URL', async () => {
    for (const env of [{}, { SUPABASE_URL: 'not a url' }]) {
      const app = express();
      app.use(securityHeaders(env));
      app.get('/', (_req, res) => res.send('x'));
      const s = app.listen(0);
      await new Promise((r) => s.once('listening', r));
      try {
        const res = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/`);
        expect(directives(res.headers.get('content-security-policy-report-only'))['connect-src']).toEqual(["'self'"]);
      } finally {
        await new Promise<void>((r) => s.close(() => r()));
      }
    }
  });
});

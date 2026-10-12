/**
 * serveStatic: built files are served, a missing /assets or /uploads file is a 404, and any
 * other path falls through to index.html so client-side routes work.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveStatic } from './static';

let dir: string;
let server: Server;
let base: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glas-static-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!DOCTYPE html>');
  fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');

  const app = express();
  serveStatic(app, dir);
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('serveStatic', () => {
  it('serves a built file', async () => {
    const res = await fetch(`${base}/assets/app-abc123.js`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('console.log(1)');
  });

  it.each(['/assets/app-old999.js', '/uploads/someone-123.png'])('returns 404, not the page, for a missing %s', async (url) => {
    const res = await fetch(`${base}${url}`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('<!DOCTYPE html>');
  });

  it('falls through to index.html for a client route', async () => {
    const res = await fetch(`${base}/td/some-td`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<!DOCTYPE html>');
  });

  it('throws when the build directory is missing', () => {
    expect(() => serveStatic(express(), path.join(dir, 'nope'))).toThrow(/Could not find the build directory/);
  });
});

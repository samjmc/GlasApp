/**
 * POST /api/region/select: the visitor's region choice. Anyone may choose; a signed-in user's
 * choice is also saved to their Supabase metadata, and a failure there does not fail the request.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const saved = vi.hoisted(() => ({ calls: [] as Array<[string, Record<string, unknown>]>, fail: false }));

vi.mock('../auth/supabase', () => ({
  updateUserMetadata: vi.fn(async (id: string, metadata: Record<string, unknown>) => {
    saved.calls.push([id, metadata]);
    if (saved.fail) throw new Error('supabase down');
  }),
}));

const regionRoutes = (await import('./regionRoutes')).default;
const { REGION_CONFIGS } = await import('@shared/region-config');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Stands in for the app-wide optionalAuth: the header names the signed-in user.
  app.use((req, _res, next) => {
    const id = req.header('x-test-user');
    if (id) req.user = { id, email: null, role: null, userMetadata: { county: 'Cork' } };
    next();
  });
  app.use('/api/region', regionRoutes);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  saved.calls = [];
  saved.fail = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const select = (body: unknown, user?: string) =>
  fetch(`${base}/api/region/select`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close', ...(user ? { 'x-test-user': user } : {}) },
    body: JSON.stringify(body),
  });

describe('POST /api/region/select', () => {
  it('rejects an unknown region in the error envelope and sets no cookie', async () => {
    for (const regionCode of ['XX', 'ie', '', null]) {
      const res = await select({ regionCode });
      expect(res.status, String(regionCode)).toBe(400);
      expect(await res.json()).toEqual({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid region code' } });
      expect(res.headers.get('set-cookie')).toBeNull();
    }
    expect(saved.calls).toEqual([]);
  });

  it('answers an anonymous visitor in the success envelope and keeps the choice in the cookie only', async () => {
    const res = await select({ regionCode: 'UK' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { regionCode: 'UK', region: REGION_CONFIGS.UK } });
    expect(res.headers.get('set-cookie')).toMatch(/^glas_region=UK;/);
    expect(saved.calls).toEqual([]);
  });

  it("saves a signed-in user's choice to their metadata, keeping the rest of it", async () => {
    expect((await select({ regionCode: 'US' }, 'u1')).status).toBe(200);
    expect(saved.calls).toEqual([['u1', { county: 'Cork', region_code: 'US' }]]);
  });

  it('still succeeds when the metadata cannot be saved: the cookie holds the choice', async () => {
    saved.fail = true;
    const res = await select({ regionCode: 'IE' }, 'u1');
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/^glas_region=IE;/);
    expect(saved.calls).toHaveLength(1);
  });
});

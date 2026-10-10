/**
 * DELETE /api/account: data first, sign-in second, and a data failure keeps the sign-in.
 * PUT/DELETE /api/account/consent/political: the Art. 9 consent record.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLITICAL_CONSENT_VERSION } from '@shared/consent';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ??= 'anon-key';
process.env.LOG_LEVEL = 'silent';

const calls = vi.hoisted(() => ({ order: [] as string[], dataFails: false, authFails: false }));

vi.mock('../auth', () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== 'Bearer ok') return res.status(401).json({ success: false });
    (req as unknown as { user: { id: string } }).user = { id: 'user-1' };
    next();
  },
}));
vi.mock('../auth/supabase', () => ({
  deleteAuthUser: vi.fn(async (id: string) => {
    calls.order.push(`auth:${id}`);
    if (calls.authFails) throw new Error('auth down');
  }),
}));
vi.mock('../account/deleteUserData', () => ({
  deleteUserData: vi.fn(async (id: string) => {
    calls.order.push(`data:${id}`);
    if (calls.dataFails) throw new Error('db down');
    return { policyVotes: 2, dailySessions: 1, pledgeCategoryPriorities: 0, quizResults: 1, ideologyProfile: 1 };
  }),
}));

vi.mock('../account/consent', () => ({
  grantPoliticalConsent: vi.fn(async (id: string) => {
    calls.order.push(`grant:${id}`);
    if (calls.dataFails) throw new Error('db down');
  }),
  withdrawPoliticalConsent: vi.fn(async (id: string) => {
    calls.order.push(`withdraw:${id}`);
    if (calls.dataFails) throw new Error('db down');
    return { policyVotes: 3, dailySessions: 1, pledgeCategoryPriorities: 1, quizResults: 2, ideologyProfile: 1 };
  }),
}));

vi.mock('../account/profileImages', () => ({
  removeProfileImages: vi.fn(async (id: string) => {
    calls.order.push(`images:${id}`);
  }),
}));

const router = (await import('./accountRoutes')).default;

async function send(method: string, path: string, auth?: string, body?: unknown) {
  const app = express();
  app.use(express.json());
  app.use('/api/account', router);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method,
      headers: { ...(auth ? { authorization: auth } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

const del = (auth?: string) => send('DELETE', '/api/account', auth);

afterEach(() => {
  calls.order = [];
  calls.dataFails = false;
  calls.authFails = false;
});

describe('DELETE /api/account', () => {
  it('deletes the data and pictures, then the sign-in, and reports the counts', async () => {
    const { status, body } = await del('Bearer ok');
    expect(status).toBe(200);
    expect(calls.order).toEqual(['data:user-1', 'images:user-1', 'auth:user-1']);
    expect(body).toEqual({
      success: true,
      data: { deleted: { policyVotes: 2, dailySessions: 1, pledgeCategoryPriorities: 0, quizResults: 1, ideologyProfile: 1 } },
    });
  });

  it('keeps the sign-in when the data delete fails', async () => {
    calls.dataFails = true;
    const { status, body } = await del('Bearer ok');
    expect(status).toBe(500);
    expect(calls.order).toEqual(['data:user-1']);
    expect(body.error.message).toMatch(/Failed to delete your data/);
  });

  it('reports a failed sign-in removal instead of claiming success', async () => {
    calls.authFails = true;
    const { status, body } = await del('Bearer ok');
    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.message).toMatch(/sign-in could not be removed/);
  });

  it('needs a signed-in caller', async () => {
    expect((await del()).status).toBe(401);
    expect(calls.order).toEqual([]);
  });
});

describe('/api/account/consent/political', () => {
  const PATH = '/api/account/consent/political';

  it('records consent for the caller when the wording they were shown is the current one', async () => {
    const { status, body } = await send('PUT', PATH, 'Bearer ok', { version: POLITICAL_CONSENT_VERSION });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, data: { version: POLITICAL_CONSENT_VERSION } });
    expect(calls.order).toEqual(['grant:user-1']);
  });

  it('refuses a stale wording and a body with no version, and records nothing', async () => {
    const stale = await send('PUT', PATH, 'Bearer ok', { version: POLITICAL_CONSENT_VERSION - 1 });
    expect(stale.status).toBe(409);
    expect((await send('PUT', PATH, 'Bearer ok', {})).status).toBe(400);
    expect(calls.order).toEqual([]);
  });

  it('withdraws and reports what was erased', async () => {
    const { status, body } = await send('DELETE', PATH, 'Bearer ok');
    expect(status).toBe(200);
    expect(calls.order).toEqual(['withdraw:user-1']);
    expect(body.data.erased).toEqual({ policyVotes: 3, dailySessions: 1, pledgeCategoryPriorities: 1, quizResults: 2, ideologyProfile: 1 });
  });

  it('needs a signed-in caller for both', async () => {
    expect((await send('PUT', PATH, undefined, { version: POLITICAL_CONSENT_VERSION })).status).toBe(401);
    expect((await send('DELETE', PATH)).status).toBe(401);
    expect(calls.order).toEqual([]);
  });

  it('answers 500, not success, when the database fails', async () => {
    calls.dataFails = true;
    expect((await send('PUT', PATH, 'Bearer ok', { version: POLITICAL_CONSENT_VERSION })).status).toBe(500);
    expect((await send('DELETE', PATH, 'Bearer ok')).status).toBe(500);
  });
});

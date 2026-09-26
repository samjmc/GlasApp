/**
 * DELETE /api/account: data first, sign-in second, and a data failure keeps the sign-in.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../account/profileImages', () => ({
  removeProfileImages: vi.fn(async (id: string) => {
    calls.order.push(`images:${id}`);
  }),
}));

const router = (await import('./accountRoutes')).default;

async function del(auth?: string) {
  const app = express();
  app.use('/api/account', router);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/account`, {
      method: 'DELETE',
      headers: auth ? { authorization: auth } : {},
    });
    return { status: res.status, body: await res.json() };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

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

/**
 * /api/profile without a database: the guard, the envelope, validation, the picture upload and its
 * limits, and what a failure looks like. The SQL is covered by profileRoutes.integration.test.ts.
 *
 * Auth is stubbed: `x-test-user` is the verified user id.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.LOG_LEVEL = 'silent';

const state = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  fail: false,
  uploadDir: '',
}));

vi.mock('../auth', () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = req.header('x-test-user');
    if (!id) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    (req as express.Request & { user: unknown }).user = { id, email: `${id}@example.ie`, role: null, userMetadata: {} };
    next();
  },
  isAdminUser: () => false,
}));

vi.mock('../db', () => ({ db: {} }));
vi.mock('../account/profile', async (importOriginal) => {
  const real = await importOriginal<typeof import('../account/profile')>();
  const row = (id: string) => ({ id, firstName: 'Aoife', lastName: null, username: null, county: 'Kerry', constituency: null, bio: null, profileImageUrl: null });
  const record =
    <A extends unknown[]>(fn: string, result: (...args: A) => unknown) =>
    async (...args: A) => {
      state.calls.push([fn, ...args]);
      if (state.fail) throw new Error('database down: select * from politics.users');
      return result(...args);
    };
  return {
    ...real,
    ensureProfile: record('ensureProfile', (id: string) => row(id)),
    backfillFromMetadata: record('backfillFromMetadata', (r: unknown) => r),
    updateProfile: record('updateProfile', (id: string, edits: object) => ({ ...row(id), ...edits })),
    setProfileImage: record('setProfileImage', () => undefined),
  };
});

vi.mock('../account/profileImages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../account/profileImages')>()),
  get UPLOAD_DIR() {
    return state.uploadDir;
  },
  removeProfileImages: vi.fn(async (...args: unknown[]) => {
    state.calls.push(['removeProfileImages', ...args]);
  }),
}));

let server: Server;
let base: string;

beforeAll(async () => {
  state.uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glas-profile-'));
  const { default: profileRoutes } = await import('./profileRoutes');
  const { errorHandler } = await import('../middleware/errorHandler');
  const app = express();
  app.use(express.json());
  app.use('/api/profile', profileRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/profile`;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(state.uploadDir, { recursive: true, force: true });
});

beforeEach(() => {
  state.calls = [];
  state.fail = false;
});

const call = async (method: string, pathname: string, init: { user?: string; json?: unknown; form?: FormData } = {}) => {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      connection: 'close',
      ...(init.user ? { 'x-test-user': init.user } : {}),
      ...(init.json === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.form ?? (init.json === undefined ? undefined : JSON.stringify(init.json)),
  });
  return { status: res.status, body: await res.json() };
};

const image = (type: string, bytes: number) => {
  const form = new FormData();
  form.append('profileImage', new Blob([new Uint8Array(bytes)], { type }), 'me.png');
  return form;
};

describe('/api/profile', () => {
  it('needs a signed-in user for every route, and touches nothing without one', async () => {
    for (const [method, pathname] of [['GET', '/me'], ['PATCH', '/me'], ['POST', '/image']]) {
      expect((await call(method, pathname)).status, `${method} ${pathname}`).toBe(401);
    }
    expect(state.calls).toEqual([]);
  });

  it("GET /me answers the caller's own profile in the envelope", async () => {
    const { status, body } = await call('GET', '/me', { user: 'user-a' });
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, data: { user: { id: 'user-a', firstName: 'Aoife', email: 'user-a@example.ie' }, isAdmin: false } });
    expect(state.calls.map(([fn]) => fn)).toEqual(['ensureProfile', 'backfillFromMetadata']);
  });

  it('PATCH /me saves an edit for the caller only', async () => {
    const { status, body } = await call('PATCH', '/me', { user: 'user-a', json: { county: 'Galway', userId: 'someone-else' } });
    expect(status).toBe(200);
    expect(body.data.user).toMatchObject({ id: 'user-a', county: 'Galway' });
    expect(state.calls).toEqual([['updateProfile', 'user-a', { county: 'Galway' }]]);
  });

  it('PATCH /me refuses a value longer than its column with 400 VALIDATION_ERROR and saves nothing', async () => {
    const { status, body } = await call('PATCH', '/me', { user: 'user-a', json: { county: 'x'.repeat(51) } });
    expect(status).toBe(400);
    expect(body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(state.calls).toEqual([]);
  });

  it('answers a database failure with a 500 that does not carry the database error', async () => {
    state.fail = true;
    const { status, body } = await call('GET', '/me', { user: 'user-a' });
    expect(status).toBe(500);
    expect(body).toEqual({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  });

  it('POST /image saves a picture under the caller id with an extension from its type, and removes their older ones', async () => {
    const { status, body } = await call('POST', '/image', { user: 'user-a', form: image('image/png', 100) });
    expect(status).toBe(200);
    expect(body.data.imageUrl).toMatch(/^\/uploads\/user-a-\d+\.png$/);
    const name = body.data.imageUrl.slice('/uploads/'.length);
    expect(fs.existsSync(path.join(state.uploadDir, name))).toBe(true);
    expect(state.calls).toEqual([
      ['setProfileImage', 'user-a', body.data.imageUrl],
      ['removeProfileImages', 'user-a', name],
    ]);
  });

  it('POST /image answers 400, not 500, for a file that is not an image or is over 5 MB, and saves nothing', async () => {
    const notImage = await call('POST', '/image', { user: 'user-a', form: image('text/html', 100) });
    expect(notImage).toEqual({ status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'No image file provided' } } });

    const tooBig = await call('POST', '/image', { user: 'user-a', form: image('image/png', 5 * 1024 * 1024 + 1) });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body).toEqual({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File too large' } });
    expect(state.calls).toEqual([]);
  });
});

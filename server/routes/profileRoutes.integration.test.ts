/**
 * GET/PATCH /api/profile/me against a real Postgres: politics.users is the one home of the profile
 * fields, and GET copies in what older clients saved to Supabase `user_metadata`. Skipped unless
 * TEST_DATABASE_URL is set; uses its own database `<db>_profile_routes`.
 *
 * Auth is stubbed: `x-test-user` is the verified user id and `x-test-meta` (JSON) their metadata.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('profile_routes');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
}

vi.mock('../auth', () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = req.header('x-test-user');
    if (!id) return res.status(401).json({ success: false, message: 'Authentication required' });
    (req as express.Request & { user: unknown }).user = {
      id,
      email: `${id}@example.ie`,
      role: null,
      userMetadata: JSON.parse(req.header('x-test-meta') ?? '{}'),
    };
    next();
  },
  isAdminUser: () => false,
}));

run('/api/profile/me against Postgres', () => {
  let dbmod: typeof import('../db');
  let server: Server;
  let base: string;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    const { default: profileRoutes } = await import('./profileRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/profile', profileRoutes);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  }, 60_000);

  beforeEach(async () => {
    await dbmod.pool.query('truncate politics.users cascade');
  });

  afterAll(async () => {
    server?.closeAllConnections?.();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (dbmod) await dbmod.shutdown();
  });

  const call = async (method: 'GET' | 'PATCH', meta: Record<string, unknown> = {}, body?: unknown, user = 'user-a') => {
    const res = await fetch(`${base}/api/profile/me`, {
      method,
      headers: { 'content-type': 'application/json', connection: 'close', 'x-test-user': user, 'x-test-meta': JSON.stringify(meta) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as { success: boolean; data: { user: Record<string, unknown> } } };
  };
  const stored = async (id = 'user-a') =>
    (await dbmod.pool.query('select first_name, last_name, county, bio, profile_image_url from politics.users where id = $1', [id])).rows[0];

  it('PATCH saves name, county and bio to the row, and GET reads them back', async () => {
    const saved = await call('PATCH', {}, { firstName: 'Máire', lastName: 'Ní Bhriain', county: 'Galway', bio: 'Hello' });
    expect(saved.status).toBe(200);
    expect(saved.body.data.user).toMatchObject({ firstName: 'Máire', lastName: 'Ní Bhriain', county: 'Galway', bio: 'Hello', email: 'user-a@example.ie' });
    expect(await stored()).toEqual({ first_name: 'Máire', last_name: 'Ní Bhriain', county: 'Galway', bio: 'Hello', profile_image_url: null });

    const read = await call('GET');
    expect(read.status).toBe(200);
    expect(read.body.data.user).toMatchObject({ firstName: 'Máire', lastName: 'Ní Bhriain', county: 'Galway', bio: 'Hello' });
  });

  it('PATCH refuses a value longer than its column with 400 and saves nothing', async () => {
    const res = await call('PATCH', {}, { county: 'x'.repeat(51) });
    expect(res.status).toBe(400);
    expect(await stored()).toBeUndefined();
  });

  it('GET creates the row for a signed-in user who has none, and copies the older metadata into it', async () => {
    const meta = { first_name: ' Aoife ', last_name: 'Tester', county: 'Kerry', bio: 'meta bio', glas_avatar_url: '/uploads/user-a-1700000000000.png', region_code: 'IE' };
    const res = await call('GET', meta);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: 'user-a', firstName: 'Aoife', lastName: 'Tester', county: 'Kerry', bio: 'meta bio', profileImageUrl: '/uploads/user-a-1700000000000.png' });
    expect(await stored()).toEqual({ first_name: 'Aoife', last_name: 'Tester', county: 'Kerry', bio: 'meta bio', profile_image_url: '/uploads/user-a-1700000000000.png' });
  });

  it('copies the username and constituency from metadata once, and drops one longer than its column', async () => {
    const res = await call('GET', { username: ' aoife ', constituency: 'Kerry' });
    expect(res.body.data.user).toMatchObject({ username: 'aoife', constituency: 'Kerry' });
    await call('GET', { username: 'other', constituency: 'Cork' });
    const row = async () => (await dbmod.pool.query('select username, constituency from politics.users where id = $1', ['user-a'])).rows[0];
    expect(await row()).toEqual({ username: 'aoife', constituency: 'Kerry' });

    await call('GET', { username: 'x'.repeat(51), constituency: 'y'.repeat(101) }, undefined, 'user-b');
    expect((await dbmod.pool.query('select username, constituency from politics.users where id = $1', ['user-b'])).rows[0]).toEqual({ username: null, constituency: null });
  });

  it('copies only into fields the row has never held: a saved value, or one cleared to blank, wins', async () => {
    await call('PATCH', {}, { firstName: 'Brid', county: '' });
    const res = await call('GET', { first_name: 'Old', county: 'Cork', bio: 'old bio' });
    expect(res.body.data.user).toMatchObject({ firstName: 'Brid', county: '', bio: 'old bio' });

    // A second GET with other metadata changes nothing: the copy happened once.
    await call('GET', { first_name: 'Older', bio: 'other bio' });
    expect(await stored()).toMatchObject({ first_name: 'Brid', county: '', bio: 'old bio' });
  });

  it('takes the Google name when there is no saved one, and ignores values that do not fit or are not ours', async () => {
    const res = await call('GET', {
      given_name: 'Siobhán',
      county: 'x'.repeat(51),
      bio: 42,
      // Someone else's file, an outside address, and a path that escapes /uploads: none are our upload of this user.
      glas_avatar_url: '/uploads/user-b-1.png',
    });
    expect(res.body.data.user).toMatchObject({ firstName: 'Siobhán', county: null, bio: null, profileImageUrl: null });
    for (const avatar of ['https://evil.example/a.png', '/uploads/user-a-1.html', '/uploads/user-a-../../x.png']) {
      await call('GET', { glas_avatar_url: avatar });
      expect((await stored()).profile_image_url, avatar).toBeNull();
    }
  });
});

/**
 * The guards. Every route in the app sits behind one of these four.
 */
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.ADMIN_API_SECRET = 'job-secret';
process.env.ADMIN_EMAILS = '';
process.env.LOG_LEVEL = 'silent';

const { state } = vi.hoisted(() => ({ state: { user: null as unknown, error: null as unknown } }));

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: state.error })) } },
  supabaseAdmin: {},
  updateUserMetadata: vi.fn(),
  deleteAuthUser: vi.fn(),
}));

const auth = await import('./index');

function mockReq(headers: Record<string, string> = {}): Request {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: lower,
    header: (n: string) => lower[n.toLowerCase()],
    method: 'GET',
    path: '/test',
  } as unknown as Request;
}

function mockRes() {
  const res = {
    statusCode: 0 as number,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as typeof res & Response;
}

const SUPA_USER = { id: 'uuid-1', email: 'user@example.com', app_metadata: {}, user_metadata: { nickname: 'u' } };
const SUPA_ADMIN = { id: 'uuid-2', email: 'boss@example.com', app_metadata: { role: 'admin' }, user_metadata: {} };

beforeEach(() => {
  state.user = null;
  state.error = null;
  process.env.ADMIN_EMAILS = '';
});
afterEach(() => vi.clearAllMocks());

describe('requireAuth', () => {
  it('401s with no header, a non-bearer header, or a rejected token', async () => {
    for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'Bearer bad' }]) {
      const res = mockRes();
      let called = false;
      state.error = headers.authorization === 'Bearer bad' ? new Error('invalid') : null;
      await auth.requireAuth(mockReq(headers), res, () => { called = true; });
      expect(called).toBe(false);
      expect(res.statusCode).toBe(401);
    }
  });

  it('attaches only the trusted fields on a valid token', async () => {
    state.user = SUPA_USER;
    const req = mockReq({ authorization: 'Bearer good' });
    let called = false;
    await auth.requireAuth(req, mockRes(), () => { called = true; });
    expect(called).toBe(true);
    expect(req.user).toEqual({ id: 'uuid-1', email: 'user@example.com', role: null, userMetadata: { nickname: 'u' } });
  });

  it('never takes a role from self-editable user_metadata', async () => {
    state.user = { ...SUPA_USER, user_metadata: { role: 'admin' } };
    const req = mockReq({ authorization: 'Bearer good' });
    await auth.requireAuth(req, mockRes(), () => {});
    expect(req.user?.role).toBeNull();
  });
});

describe('optionalAuth', () => {
  it('continues without a user and continues with one', async () => {
    const anon = mockReq();
    let calls = 0;
    await auth.optionalAuth(anon, mockRes(), () => { calls++; });
    expect(anon.user).toBeUndefined();

    state.user = SUPA_USER;
    const signedIn = mockReq({ authorization: 'Bearer good' });
    await auth.optionalAuth(signedIn, mockRes(), () => { calls++; });
    expect(signedIn.user?.id).toBe('uuid-1');
    expect(calls).toBe(2);
  });
});

describe('requireAdmin', () => {
  it('401 unauthenticated, 403 for a plain user, allows an app_metadata admin', async () => {
    const anon = mockRes();
    await auth.requireAdmin(mockReq(), anon, () => {});
    expect(anon.statusCode).toBe(401);

    state.user = SUPA_USER;
    const plain = mockRes();
    let called = false;
    await auth.requireAdmin(mockReq({ authorization: 'Bearer good' }), plain, () => { called = true; });
    expect(plain.statusCode).toBe(403);
    expect(called).toBe(false);

    state.user = SUPA_ADMIN;
    const ok = mockRes();
    await auth.requireAdmin(mockReq({ authorization: 'Bearer good' }), ok, () => { called = true; });
    expect(called).toBe(true);
  });

  it('grants admin by email allowlist without an app_metadata role', async () => {
    process.env.ADMIN_EMAILS = 'boss@example.com, other@example.com';
    state.user = { ...SUPA_USER, email: 'BOSS@example.com' };
    let called = false;
    await auth.requireAdmin(mockReq({ authorization: 'Bearer good' }), mockRes(), () => { called = true; });
    expect(called).toBe(true);
  });
});

describe('requireJob', () => {
  it('accepts the secret in x-admin-secret and x-cron-secret', async () => {
    for (const header of ['x-admin-secret', 'x-cron-secret']) {
      let called = false;
      await auth.requireJob(mockReq({ [header]: 'job-secret' }), mockRes(), () => { called = true; });
      expect(called).toBe(true);
    }
  });

  it('rejects a wrong secret without falling through to the admin check', async () => {
    state.user = SUPA_ADMIN;
    const res = mockRes();
    let called = false;
    await auth.requireJob(mockReq({ 'x-admin-secret': 'nope', authorization: 'Bearer good' }), res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('does NOT accept the job secret through Authorization: Bearer', async () => {
    state.error = new Error('not a token');
    const res = mockRes();
    let called = false;
    await auth.requireJob(mockReq({ authorization: 'Bearer job-secret' }), res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('falls back to an admin bearer token when no secret header is present', async () => {
    state.user = SUPA_ADMIN;
    let called = false;
    await auth.requireJob(mockReq({ authorization: 'Bearer good' }), mockRes(), () => { called = true; });
    expect(called).toBe(true);
  });
});

describe('secretsMatch', () => {
  it('is true only for an exact match, and safe on differing lengths', () => {
    expect(auth.secretsMatch('abc', 'abc')).toBe(true);
    expect(auth.secretsMatch('abc', 'abd')).toBe(false);
    expect(auth.secretsMatch('abc', 'abcd')).toBe(false);
    expect(auth.secretsMatch('', '')).toBe(true);
  });
});

describe('ownsOrAdmin', () => {
  const withUser = (user: unknown) => ({ ...mockReq(), user } as Request);

  it('allows the owner, 403s another user, allows an admin, 401s anonymous', () => {
    expect(auth.ownsOrAdmin(withUser({ id: 'me', email: null, role: null, userMetadata: {} }), mockRes(), 'me')).toBe(true);

    const other = mockRes();
    expect(auth.ownsOrAdmin(withUser({ id: 'me', email: null, role: null, userMetadata: {} }), other, 'someone')).toBe(false);
    expect(other.statusCode).toBe(403);

    expect(auth.ownsOrAdmin(withUser({ id: 'me', email: null, role: 'admin', userMetadata: {} }), mockRes(), 'someone')).toBe(true);

    const anon = mockRes();
    expect(auth.ownsOrAdmin(mockReq(), anon, 'someone')).toBe(false);
    expect(anon.statusCode).toBe(401);
  });
});

describe('currentUserId', () => {
  it('is the id or null', () => {
    expect(auth.currentUserId(mockReq())).toBeNull();
    expect(auth.currentUserId({ ...mockReq(), user: { id: 'x' } } as Request)).toBe('x');
  });
});

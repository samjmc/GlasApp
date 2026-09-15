import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.ADMIN_API_SECRET = 'cron-secret';
process.env.ADMIN_EMAILS = '';

vi.mock('../auth/supabaseAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/supabaseAuth')>();
  return {
    ...actual,
    getUserFromRequest: vi.fn(async () => null),
  };
});

const adminAccess = await import('./adminAccess');

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    header() {
      return undefined;
    },
    method: 'GET',
    path: '/test',
    ...overrides,
  } as Request;
}

function mockResponse(): Response & { statusCode?: number; body?: unknown } {
  const res = {
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  } as Response & { statusCode?: number; body?: unknown };

  return res;
}

describe('requireRole', () => {
  afterEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAILS = '';
  });

  it('returns 401 when there is no identity', async () => {
    const req = mockRequest();
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { success: false, message: 'Authentication required' });
  });

  it('returns 403 when the caller role is not allowed', async () => {
    const req = mockRequest({
      user: { id: 'user-id', email: 'user@example.com', app_metadata: { role: 'user' } },
    });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { success: false, message: 'Access denied' });
  });

  it('calls next for an admin role caller', async () => {
    const req = mockRequest({
      user: { id: 'admin-id', email: 'admin@example.com', app_metadata: { role: 'admin' } },
    });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });

  it('accepts any of the allowed roles', async () => {
    const req = mockRequest({
      user: { id: 'mod-id', email: 'mod@example.com', app_metadata: { role: 'moderator' } },
    });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin', 'moderator')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });

  it('grants admin via the ADMIN_EMAILS allowlist even without an app_metadata role', async () => {
    process.env.ADMIN_EMAILS = 'allow@example.com, other@example.com';
    const req = mockRequest({
      user: { id: 'allow-id', email: 'allow@example.com', app_metadata: {} },
    });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });

  it('does not trust self-editable user_metadata roles', async () => {
    const req = mockRequest({
      user: { id: 'spoof-id', email: 'spoof@example.com', app_metadata: {}, user_metadata: { role: 'admin' } },
    });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 403);
  });
});
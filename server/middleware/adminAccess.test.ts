import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.ADMIN_API_SECRET = 'cron-secret';
process.env.ADMIN_EMAILS = '';

const adminAccess = await import('./adminAccess');
const supabaseAuth = await import('../auth/supabaseAuth');

function mockRequest(headers: Record<string, string> = {}): Request {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    headers: normalized,
    header(name: string) {
      return normalized[name.toLowerCase()];
    },
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

test('requireAdminAccess accepts configured job secrets', async () => {
  const req = mockRequest({ 'x-admin-secret': 'cron-secret' });
  const res = mockResponse();
  let calledNext = false;

  await adminAccess.requireAdminAccess(req, res, (() => {
    calledNext = true;
  }) as NextFunction);

  assert.equal(calledNext, true);
  assert.equal(res.statusCode, undefined);
});

test('requireAdminAccess rejects unauthenticated requests without the job secret', async () => {
  const req = mockRequest({ 'x-admin-secret': 'wrong-secret' });
  const res = mockResponse();
  let calledNext = false;

  await adminAccess.requireAdminAccess(req, res, (() => {
    calledNext = true;
  }) as NextFunction);

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 401);
});

test('isAdmin ignores self-editable user metadata roles', async () => {
  (supabaseAuth.supabase.auth as any).getUser = async () => ({
    data: {
      user: {
        id: 'user-id',
        email: 'user@example.com',
        user_metadata: { role: 'admin' },
        app_metadata: {},
      },
    },
    error: null,
  });

  const req = mockRequest({ authorization: 'Bearer user-token' });
  const res = mockResponse();
  let calledNext = false;

  await supabaseAuth.isAdmin(req, res, (() => {
    calledNext = true;
  }) as NextFunction);

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 403);
});

test('isAdmin accepts server-owned app metadata roles', async () => {
  (supabaseAuth.supabase.auth as any).getUser = async () => ({
    data: {
      user: {
        id: 'admin-id',
        email: 'admin@example.com',
        user_metadata: {},
        app_metadata: { role: 'admin' },
      },
    },
    error: null,
  });

  const req = mockRequest({ authorization: 'Bearer admin-token' });
  const res = mockResponse();
  let calledNext = false;

  await supabaseAuth.isAdmin(req, res, (() => {
    calledNext = true;
  }) as NextFunction);

  assert.equal(calledNext, true);
  assert.equal(res.statusCode, undefined);
});

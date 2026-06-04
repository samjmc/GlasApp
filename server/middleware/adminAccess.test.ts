import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import {
  hasAdminCredentials,
  hasValidAdminSecret,
  requireAdminAccess,
} from './adminAccess';

type Headers = Record<string, string | undefined>;

function makeRequest(headers: Headers = {}): Request {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    get(name: string) {
      return normalized[name.toLowerCase()];
    },
  } as Request;
}

function makeResponse(): Response & { statusCode?: number; body?: unknown } {
  return {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as Response & { statusCode?: number; body?: unknown };
}

test('hasAdminCredentials detects supported admin headers', () => {
  assert.equal(hasAdminCredentials(makeRequest()), false);
  assert.equal(hasAdminCredentials(makeRequest({ authorization: 'Bearer token' })), true);
  assert.equal(hasAdminCredentials(makeRequest({ 'x-admin-secret': 'token' })), true);
  assert.equal(hasAdminCredentials(makeRequest({ 'x-cron-secret': 'token' })), true);
});

test('hasValidAdminSecret accepts configured admin secrets only', () => {
  const previousAdminSecret = process.env.ADMIN_API_SECRET;
  const previousCronSecret = process.env.CRON_SECRET;
  process.env.ADMIN_API_SECRET = 'admin-secret';
  process.env.CRON_SECRET = 'cron-secret';

  try {
    assert.equal(
      hasValidAdminSecret(makeRequest({ authorization: 'Bearer admin-secret' })),
      true,
    );
    assert.equal(
      hasValidAdminSecret(makeRequest({ 'x-cron-secret': 'cron-secret' })),
      true,
    );
    assert.equal(
      hasValidAdminSecret(makeRequest({ 'x-admin-secret': 'wrong-secret' })),
      false,
    );
  } finally {
    process.env.ADMIN_API_SECRET = previousAdminSecret;
    process.env.CRON_SECRET = previousCronSecret;
  }
});

test('requireAdminAccess rejects requests without credentials', async () => {
  const req = makeRequest();
  const res = makeResponse();
  let nextCalled = false;

  await requireAdminAccess(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    message: 'Admin access required',
  });
});

test('requireAdminAccess allows requests with a configured cron secret', async () => {
  const previousCronSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'cron-secret';

  try {
    const req = makeRequest({ authorization: 'Bearer cron-secret' });
    const res = makeResponse();
    let nextCalled = false;

    await requireAdminAccess(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, undefined);
    assert.equal(res.body, undefined);
  } finally {
    process.env.CRON_SECRET = previousCronSecret;
  }
});

test('requireAdminAccess rejects invalid non-bearer shared secrets', async () => {
  const previousCronSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'cron-secret';

  try {
    const req = makeRequest({ 'x-admin-secret': 'wrong-secret' });
    const res = makeResponse();
    let nextCalled = false;

    await requireAdminAccess(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      success: false,
      message: 'Admin access required',
    });
  } finally {
    process.env.CRON_SECRET = previousCronSecret;
  }
});

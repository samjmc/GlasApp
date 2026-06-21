import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Request, Response } from 'express';
import {
  isAdminRouteRequestAuthorized,
  requireAdminRouteAuth,
} from './adminRouteAuth';

const ORIGINAL_ENV = {
  ADMIN_API_SECRET: process.env.ADMIN_API_SECRET,
  ADMIN_JOB_SECRET: process.env.ADMIN_JOB_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
};

type MockResponse = Response & {
  body?: unknown;
  statusCodeValue?: number;
};

function clearAdminSecrets(): void {
  delete process.env.ADMIN_API_SECRET;
  delete process.env.ADMIN_JOB_SECRET;
  delete process.env.CRON_SECRET;
}

function restoreAdminSecrets(): void {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function createRequest(headers: Record<string, string | string[]> = {}): Request {
  return { headers } as Request;
}

function createResponse(): MockResponse {
  const response = {
    status(code: number) {
      this.statusCodeValue = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as MockResponse;

  return response;
}

describe('adminRouteAuth', () => {
  beforeEach(() => {
    clearAdminSecrets();
  });

  afterEach(() => {
    restoreAdminSecrets();
  });

  it('fails closed when no admin secret is configured', () => {
    const req = createRequest({ 'x-admin-secret': 'provided-secret' });
    const res = createResponse();
    let nextCalled = false;

    requireAdminRouteAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCodeValue, 503);
    assert.deepEqual(res.body, {
      success: false,
      message: 'Admin route authentication is not configured',
    });
  });

  it('accepts a configured x-admin-secret header', () => {
    process.env.ADMIN_API_SECRET = 'api-secret';

    const req = createRequest({ 'x-admin-secret': 'api-secret' });
    const res = createResponse();
    let nextCalled = false;

    requireAdminRouteAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCodeValue, undefined);
  });

  it('accepts a configured x-admin-job-secret header', () => {
    process.env.ADMIN_JOB_SECRET = 'job-secret';

    assert.equal(
      isAdminRouteRequestAuthorized(createRequest({ 'x-admin-job-secret': 'job-secret' })),
      true,
    );
  });

  it('accepts a bearer token matching CRON_SECRET', () => {
    process.env.CRON_SECRET = 'cron-secret';

    assert.equal(
      isAdminRouteRequestAuthorized(createRequest({ authorization: 'Bearer cron-secret' })),
      true,
    );
  });

  it('rejects an incorrect secret', () => {
    process.env.ADMIN_API_SECRET = 'api-secret';

    const req = createRequest({ 'x-admin-secret': 'wrong-secret' });
    const res = createResponse();
    let nextCalled = false;

    requireAdminRouteAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCodeValue, 401);
    assert.deepEqual(res.body, {
      success: false,
      message: 'Admin route authentication required',
    });
  });
});

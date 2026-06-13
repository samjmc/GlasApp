import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';

import {
  adminJobSecretMatches,
  getProvidedAdminJobSecret,
  requireAdminJobAuth
} from './adminJobAuth';

function mockRequest(headers: Record<string, string | undefined> = {}): Pick<Request, 'get'> {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    get(name: string): string | undefined {
      return normalizedHeaders[name.toLowerCase()];
    }
  };
}

function mockResponse(): Pick<Response, 'status' | 'json'> & {
  statusCode?: number;
  body?: unknown;
} {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };

  return res;
}

function withAdminJobEnv(env: Record<string, string | undefined>, callback: () => void): void {
  const originalEnv = {
    ADMIN_JOB_SECRET: process.env.ADMIN_JOB_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    ALLOW_UNAUTHENTICATED_ADMIN_JOBS: process.env.ALLOW_UNAUTHENTICATED_ADMIN_JOBS,
    NODE_ENV: process.env.NODE_ENV
  };

  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    callback();
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('extracts admin job secret from x-admin-job-secret header', () => {
  const req = mockRequest({ 'x-admin-job-secret': ' shared-secret ' });

  assert.equal(getProvidedAdminJobSecret(req), 'shared-secret');
});

test('extracts admin job secret from bearer authorization header', () => {
  const req = mockRequest({ authorization: 'Bearer shared-secret' });

  assert.equal(getProvidedAdminJobSecret(req), 'shared-secret');
});

test('compares admin job secrets exactly', () => {
  assert.equal(adminJobSecretMatches('shared-secret', 'shared-secret'), true);
  assert.equal(adminJobSecretMatches('wrong-secret', 'shared-secret'), false);
  assert.equal(adminJobSecretMatches('shared-secret-longer', 'shared-secret'), false);
});

test('rejects admin job request when no secret is configured', () => {
  withAdminJobEnv(
    {
      ADMIN_JOB_SECRET: undefined,
      CRON_SECRET: undefined,
      ALLOW_UNAUTHENTICATED_ADMIN_JOBS: undefined,
      NODE_ENV: 'production'
    },
    () => {
      const res = mockResponse();
      let nextCalled = false;

      requireAdminJobAuth(
        mockRequest() as Request,
        res as Response,
        () => {
          nextCalled = true;
        }
      );

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.body, {
        success: false,
        message: 'Admin job authentication is not configured'
      });
    }
  );
});

test('rejects admin job request with missing or wrong secret', () => {
  withAdminJobEnv({ ADMIN_JOB_SECRET: 'shared-secret', CRON_SECRET: undefined }, () => {
    const res = mockResponse();
    let nextCalled = false;

    requireAdminJobAuth(
      mockRequest({ authorization: 'Bearer wrong-secret' }) as Request,
      res as Response,
      () => {
        nextCalled = true;
      }
    );

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, {
      success: false,
      message: 'Unauthorized'
    });
  });
});

test('allows admin job request with configured bearer secret', () => {
  withAdminJobEnv({ ADMIN_JOB_SECRET: 'shared-secret', CRON_SECRET: undefined }, () => {
    const res = mockResponse();
    let nextCalled = false;

    requireAdminJobAuth(
      mockRequest({ authorization: 'Bearer shared-secret' }) as Request,
      res as Response,
      () => {
        nextCalled = true;
      }
    );

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, undefined);
    assert.equal(res.body, undefined);
  });
});

test('allows explicit local development bypass only outside production', () => {
  withAdminJobEnv(
    {
      ADMIN_JOB_SECRET: undefined,
      CRON_SECRET: undefined,
      ALLOW_UNAUTHENTICATED_ADMIN_JOBS: 'true',
      NODE_ENV: 'development'
    },
    () => {
      const res = mockResponse();
      let nextCalled = false;

      requireAdminJobAuth(
        mockRequest() as Request,
        res as Response,
        () => {
          nextCalled = true;
        }
      );

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, undefined);
    }
  );
});

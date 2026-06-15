import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';

import {
  adminRouteSecretMatches,
  getConfiguredAdminRouteSecret,
  getProvidedAdminRouteSecret,
  requireAdminRouteAuth
} from './adminRouteAuth';

type MockResponse = Pick<Response, 'status' | 'json'> & {
  statusCode?: number;
  body?: unknown;
};

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

function mockResponse(): MockResponse {
  return {
    statusCode: undefined,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
}

function withAdminRouteEnv(env: Record<string, string | undefined>, callback: () => void): void {
  const originalEnv = {
    ADMIN_API_SECRET: process.env.ADMIN_API_SECRET,
    ADMIN_JOB_SECRET: process.env.ADMIN_JOB_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    ALLOW_UNAUTHENTICATED_ADMIN_ROUTES: process.env.ALLOW_UNAUTHENTICATED_ADMIN_ROUTES,
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

test('uses the first configured admin route secret', () => {
  assert.equal(
    getConfiguredAdminRouteSecret({
      ADMIN_API_SECRET: ' admin-api-secret ',
      ADMIN_JOB_SECRET: 'admin-job-secret',
      CRON_SECRET: 'cron-secret'
    }),
    'admin-api-secret'
  );
});

test('falls back to legacy admin job and cron secret names', () => {
  assert.equal(
    getConfiguredAdminRouteSecret({
      ADMIN_API_SECRET: undefined,
      ADMIN_JOB_SECRET: undefined,
      CRON_SECRET: ' cron-secret '
    }),
    'cron-secret'
  );
});

test('extracts admin route secret from supported headers', () => {
  assert.equal(
    getProvidedAdminRouteSecret(mockRequest({ 'x-admin-secret': ' shared-secret ' })),
    'shared-secret'
  );
  assert.equal(
    getProvidedAdminRouteSecret(mockRequest({ 'x-admin-job-secret': ' job-secret ' })),
    'job-secret'
  );
});

test('extracts admin route secret from bearer authorization header', () => {
  const req = mockRequest({ authorization: 'Bearer shared-secret' });

  assert.equal(getProvidedAdminRouteSecret(req), 'shared-secret');
});

test('compares admin route secrets exactly', () => {
  assert.equal(adminRouteSecretMatches('shared-secret', 'shared-secret'), true);
  assert.equal(adminRouteSecretMatches('wrong-secret', 'shared-secret'), false);
  assert.equal(adminRouteSecretMatches('shared-secret-longer', 'shared-secret'), false);
});

test('rejects admin route request when no secret is configured', () => {
  withAdminRouteEnv(
    {
      ADMIN_API_SECRET: undefined,
      ADMIN_JOB_SECRET: undefined,
      CRON_SECRET: undefined,
      ALLOW_UNAUTHENTICATED_ADMIN_ROUTES: undefined,
      NODE_ENV: 'production'
    },
    () => {
      const res = mockResponse();
      let nextCalled = false;

      requireAdminRouteAuth(
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
        message: 'Admin route authentication is not configured'
      });
    }
  );
});

test('rejects admin route request with missing or wrong secret', () => {
  withAdminRouteEnv(
    {
      ADMIN_API_SECRET: 'shared-secret',
      ADMIN_JOB_SECRET: undefined,
      CRON_SECRET: undefined
    },
    () => {
      const missingRes = mockResponse();
      let missingNextCalled = false;

      requireAdminRouteAuth(
        mockRequest() as Request,
        missingRes as Response,
        () => {
          missingNextCalled = true;
        }
      );

      assert.equal(missingNextCalled, false);
      assert.equal(missingRes.statusCode, 401);

      const wrongRes = mockResponse();
      let wrongNextCalled = false;

      requireAdminRouteAuth(
        mockRequest({ authorization: 'Bearer wrong-secret' }) as Request,
        wrongRes as Response,
        () => {
          wrongNextCalled = true;
        }
      );

      assert.equal(wrongNextCalled, false);
      assert.equal(wrongRes.statusCode, 401);
      assert.deepEqual(wrongRes.body, {
        success: false,
        message: 'Unauthorized'
      });
    }
  );
});

test('allows admin route request with configured secret', () => {
  withAdminRouteEnv(
    {
      ADMIN_API_SECRET: 'shared-secret',
      ADMIN_JOB_SECRET: undefined,
      CRON_SECRET: undefined
    },
    () => {
      const res = mockResponse();
      let nextCalled = false;

      requireAdminRouteAuth(
        mockRequest({ 'x-admin-secret': 'shared-secret' }) as Request,
        res as Response,
        () => {
          nextCalled = true;
        }
      );

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, undefined);
      assert.equal(res.body, undefined);
    }
  );
});

test('allows explicit local development bypass only outside production', () => {
  withAdminRouteEnv(
    {
      ADMIN_API_SECRET: undefined,
      ADMIN_JOB_SECRET: undefined,
      CRON_SECRET: undefined,
      ALLOW_UNAUTHENTICATED_ADMIN_ROUTES: 'true',
      NODE_ENV: 'development'
    },
    () => {
      const res = mockResponse();
      let nextCalled = false;

      requireAdminRouteAuth(
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

  withAdminRouteEnv(
    {
      ADMIN_API_SECRET: undefined,
      ADMIN_JOB_SECRET: undefined,
      CRON_SECRET: undefined,
      ALLOW_UNAUTHENTICATED_ADMIN_ROUTES: 'true',
      NODE_ENV: 'production'
    },
    () => {
      const res = mockResponse();
      let nextCalled = false;

      requireAdminRouteAuth(
        mockRequest() as Request,
        res as Response,
        () => {
          nextCalled = true;
        }
      );

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 503);
    }
  );
});

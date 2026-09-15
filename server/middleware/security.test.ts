import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

// Env must be set before any dynamic import of app modules (adminAccess reads
// ADMIN_API_SECRET at module load; supabaseAuth requires SUPABASE_* at import).
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.ADMIN_API_SECRET = 'cron-secret';
process.env.ADMIN_EMAILS = '';
process.env.LOG_LEVEL = 'silent';

const { authState, dbState } = vi.hoisted(() => {
  const authState: { current: unknown } = { current: null };
  const dbState = {
    selectResult: [] as unknown[],
    insertResult: [] as unknown[],
    insertValues: undefined as unknown,
    updateResult: undefined as unknown,
    db: {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => dbState.selectResult,
          }),
        }),
      })),
      insert: vi.fn(() => ({
        values: (values: unknown) => {
          dbState.insertValues = values;
          return {
            returning: async () => dbState.insertResult,
            onConflictDoNothing: async () => dbState.insertResult,
          };
        },
      })),
      update: vi.fn(() => ({
        set: () => ({
          where: async () => dbState.updateResult,
        }),
      })),
      delete: vi.fn(() => ({ where: async () => undefined })),
    },
  };
  return { authState, dbState };
});

vi.mock('../db', () => ({
  pool: null,
  supabaseDb: null,
  db: dbState.db,
  shutdown: vi.fn(),
  checkDatabaseConnection: vi.fn(async () => true),
}));

vi.mock('../services/botService', () => ({
  BotService: {
    createBotAccount: vi.fn(async () => ({
      id: 1,
      username: 'bot1',
      email: 'bot@example.com',
      role: 'bot',
    })),
    getAllBots: vi.fn(async () => []),
    deleteBotAccount: vi.fn(async () => true),
    isBotAccount: vi.fn(() => false),
  },
}));

vi.mock('../services/twilioService', () => ({
  sendSMS: vi.fn(async () => ({ success: true, sid: 'SM123', message: 'SMS sent successfully' })),
  isTwilioConfigured: vi.fn(() => true),
}));

vi.mock('../services/aiService', () => ({
  callChatCompletion: vi.fn(async () => ({ choices: [{ message: { content: '{}' } }] })),
  callAI: vi.fn(),
  callResponses: vi.fn(),
  callEmbedding: vi.fn(),
  callImageGeneration: vi.fn(),
  callAnthropicMessage: vi.fn(),
}));

vi.mock('../services/openaiService', () => ({
  generatePoliticalProfileExplanation: vi.fn(),
  generatePoliticalMatches: vi.fn(),
  generatePolicyPredictions: vi.fn(),
  generateHistoricalContext: vi.fn(),
  generateAnswerExplanation: vi.fn(),
  generateCompleteProfileAnalysis: vi.fn(),
  generateContextAwareAnalysis: vi.fn(),
  analyzePoliticalSentiment: vi.fn(),
  analyzeBulkResponses: vi.fn(async () => ({ summary: 'mocked bulk analysis' })),
}));

vi.mock('../services/cacheService', () => ({
  cached: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  TTL: { ONE_DAY: 86400000 },
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    clearExpired: vi.fn(),
  },
  CacheService: { clearAllCaches: vi.fn(async () => undefined) },
}));

// The @shared/* aliases are configured for vite but not for vitest; providing
// mocks for them lets the route modules load in the test runner.
vi.mock('@shared/schema', () => {
  const table = (name: string) => ({ name });
  return {
    users: table('users'),
    userLocations: table('user_locations'),
    ideas: table('ideas'),
    ideaVotes: table('idea_votes'),
    constituencies: table('constituencies'),
    parties: table('parties'),
    electionResults: table('election_results'),
    elections: table('elections'),
    quizResults: table('quiz_results'),
    userPreferences: table('user_preferences'),
  };
});

vi.mock('@shared/quizTypes', () => ({ IdeologicalDimensions: {} }));

const supabaseAuth = await import('../auth/supabaseAuth');
const adminAccess = await import('./adminAccess');
const sessionMod = await import('./sessionMiddleware');
const botRoutes = (await import('../routes/botRoutes')).default;
const ideasRoutes = (await import('../routes/ideasRoutes')).default;
const smsRoutes = (await import('../routes/smsRoutes')).default;
const analysisRoutes = (await import('../routes/ai/analysis')).default;
const geoRoutes = (await import('../routes/geographic/index')).default;

const ADMIN_USER = { id: 'admin-id', email: 'admin@example.com', app_metadata: { role: 'admin' } };
const REGULAR_USER = { id: 'user-42', email: 'user@example.com', app_metadata: { role: 'user' } };

function setAuthUser(user: unknown): void {
  authState.current = user;
}

function mockRequest(headers: Record<string, string> = {}, extra: Partial<Request> = {}): Request {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    headers: normalized,
    header(name: string) {
      return normalized[name.toLowerCase()];
    },
    method: 'GET',
    path: '/test',
    ...extra,
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

function installAuthUserMock(): void {
  (supabaseAuth.supabase.auth as any).getUser = async () => {
    if (!authState.current) {
      return { data: { user: null }, error: new Error('no user') };
    }
    return { data: { user: authState.current }, error: null };
  };
}

async function withServer(app: express.Express, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'content-type': 'application/json', connection: 'close', ...extra };
}

beforeEach(() => {
  setAuthUser(null);
  dbState.selectResult = [];
  dbState.insertResult = [];
  dbState.insertValues = undefined;
  installAuthUserMock();
});

afterEach(() => {
  setAuthUser(null);
  process.env.ADMIN_EMAILS = '';
  vi.clearAllMocks();
});

describe('requireAdminAccess', () => {
  it('accepts the configured x-admin-secret and calls next', async () => {
    const req = mockRequest({ 'x-admin-secret': 'cron-secret' });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireAdminAccess(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });

  it('rejects a request with no secret and no token with 401', async () => {
    const req = mockRequest();
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireAdminAccess(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { success: false, message: 'Authentication required' });
  });

  it('rejects a wrong secret with 401 (falls through to auth check)', async () => {
    const req = mockRequest({ 'x-admin-secret': 'wrong-secret' });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireAdminAccess(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 401);
  });

  it('accepts a bearer JWT for an admin user and calls next', async () => {
    setAuthUser(ADMIN_USER);
    const req = mockRequest({ authorization: 'Bearer admin-token' });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireAdminAccess(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });

  it('rejects a bearer JWT for a non-admin user with 403', async () => {
    setAuthUser(REGULAR_USER);
    const req = mockRequest({ authorization: 'Bearer user-token' });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireAdminAccess(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { success: false, message: 'Admin access required' });
  });
});

describe('requireRole', () => {
  it('returns 401 when there is no identity', async () => {
    const req = mockRequest();
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 401);
  });

  it('returns 403 when the caller role is user and admin is required', async () => {
    const req = mockRequest({}, { user: REGULAR_USER });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 403);
  });

  it('calls next for an admin role caller', async () => {
    const req = mockRequest({}, { user: ADMIN_USER });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });

  it('accepts either of the allowed roles (moderator variant)', async () => {
    const req = mockRequest({}, { user: { id: 'mod-id', email: 'mod@example.com', app_metadata: { role: 'moderator' } } });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin', 'moderator')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });

  it('grants admin via the ADMIN_EMAILS allowlist without an app_metadata role', async () => {
    process.env.ADMIN_EMAILS = 'allow@example.com, other@example.com';
    const req = mockRequest({}, { user: { id: 'allow-id', email: 'allow@example.com', app_metadata: {} } });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });

  it('resolves identity from a bearer token when req.user is not set', async () => {
    setAuthUser(ADMIN_USER);
    const req = mockRequest({ authorization: 'Bearer admin-token' });
    const res = mockResponse();
    let calledNext = false;

    await adminAccess.requireRole('admin')(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
  });
});

describe('isAuthenticated (sessionMiddleware)', () => {
  it('calls next and populates req.user when a session userId is present', async () => {
    const req = mockRequest({}, { session: { userId: 42 } });
    const res = mockResponse();
    let calledNext = false;

    await sessionMod.isAuthenticated(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
    assert.deepEqual(req.user, { id: 42, sub: '42' });
  });

  it('returns 401 when there is neither a session nor a valid token', async () => {
    const req = mockRequest();
    const res = mockResponse();
    let calledNext = false;

    await sessionMod.isAuthenticated(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { success: false, message: 'Authentication required' });
  });

  it('calls next with a valid bearer token', async () => {
    setAuthUser(REGULAR_USER);
    const req = mockRequest({ authorization: 'Bearer user-token' });
    const res = mockResponse();
    let calledNext = false;

    await sessionMod.isAuthenticated(req, res, (() => {
      calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(res.statusCode, undefined);
    assert.deepEqual(req.user, REGULAR_USER);
  });
});

describe('route-level: botRoutes /create', () => {
  function makeApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use('/api/bots', botRoutes);
    return app;
  }

  it('creates a bot with the admin secret (201)', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/bots/create`, {
        method: 'POST',
        headers: jsonHeaders({ 'x-admin-secret': 'cron-secret' }),
        body: JSON.stringify({ username: 'bot1', email: 'bot@example.com' }),
      });
      const body = (await res.json()) as { success: boolean };
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
    });
  });

  it('returns 401 with no auth', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/bots/create`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ username: 'bot1', email: 'bot@example.com' }),
      });
      assert.equal(res.status, 401);
    });
  });

  it('returns 403 for a non-admin bearer token', async () => {
    setAuthUser(REGULAR_USER);
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/bots/create`, {
        method: 'POST',
        headers: jsonHeaders({ authorization: 'Bearer user-token' }),
        body: JSON.stringify({ username: 'bot1', email: 'bot@example.com' }),
      });
      assert.equal(res.status, 403);
    });
  });

  it('returns 400 when username is missing', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/bots/create`, {
        method: 'POST',
        headers: jsonHeaders({ 'x-admin-secret': 'cron-secret' }),
        body: JSON.stringify({ email: 'bot@example.com' }),
      });
      assert.equal(res.status, 400);
    });
  });
});

describe('route-level: ideasRoutes /submit', () => {
  function makeApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use('/api/ideas', ideasRoutes);
    return app;
  }

  const validIdea = { title: 'My idea', description: 'Desc', category: 'Economy', isAdminSubmission: true };

  it('submits an idea for an admin caller (200)', async () => {
    setAuthUser(ADMIN_USER);
    dbState.selectResult = [{ id: 'admin-id', firstName: 'Admin', lastName: 'User', username: 'admin' }];
    dbState.insertResult = [{ id: 1, title: 'My idea', category: 'Economy' }];

    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/ideas/submit`, {
        method: 'POST',
        headers: jsonHeaders({ authorization: 'Bearer admin-token' }),
        body: JSON.stringify(validIdea),
      });
      const body = (await res.json()) as { success: boolean };
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.deepEqual((dbState.insertValues as Record<string, unknown>).userId, 'admin-id');
    });
  });

  it('returns 401 with no auth', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/ideas/submit`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(validIdea),
      });
      assert.equal(res.status, 401);
    });
  });

  it('returns 403 for a non-admin token even with isAdminSubmission:true', async () => {
    setAuthUser(REGULAR_USER);
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/ideas/submit`, {
        method: 'POST',
        headers: jsonHeaders({ authorization: 'Bearer user-token' }),
        body: JSON.stringify(validIdea),
      });
      assert.equal(res.status, 403);
    });
  });

  it('returns 400 when title is missing', async () => {
    setAuthUser(ADMIN_USER);
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/ideas/submit`, {
        method: 'POST',
        headers: jsonHeaders({ authorization: 'Bearer admin-token' }),
        body: JSON.stringify({ description: 'Desc', category: 'Economy' }),
      });
      assert.equal(res.status, 400);
    });
  });
});

describe('route-level: smsRoutes /test', () => {
  function makeApp(): express.Express {
    const app = express();
    app.use('/api/sms', smsRoutes);
    return app;
  }

  it('returns 401 with no auth', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/sms/test`, { headers: { connection: 'close' } });
      assert.equal(res.status, 401);
    });
  });

  it('returns 200 with the admin secret', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/sms/test`, {
        headers: { connection: 'close', 'x-admin-secret': 'cron-secret' },
      });
      const body = (await res.json()) as { success: boolean };
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
    });
  });
});

describe('route-level: ai/analysis /analyze-bulk', () => {
  function makeApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use('/api/ai', analysisRoutes);
    return app;
  }

  it('returns 400 when more than 50 responses are supplied', async () => {
    const responses = Array.from({ length: 51 }, () => ({ text: 'agree', question: 'q' }));
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/ai/analyze-bulk`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ responses }),
      });
      assert.equal(res.status, 400);
    });
  });

  it('returns 200 for a single response (mocked analyzeBulkResponses)', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/ai/analyze-bulk`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ responses: [{ text: 'agree', question: 'q' }] }),
      });
      const body = (await res.json()) as { success: boolean };
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
    });
  });
});

describe('route-level: geographic /users/location', () => {
  function makeApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use('/api/location', geoRoutes);
    return app;
  }

  const locationBody = { userId: 'user-42', latitude: 53.3, longitude: -6.2 };

  it('returns 403 when the body userId differs from the token id', async () => {
    setAuthUser(REGULAR_USER);
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/location/users/location`, {
        method: 'POST',
        headers: jsonHeaders({ authorization: 'Bearer user-token' }),
        body: JSON.stringify({ ...locationBody, userId: 'user-99' }),
      });
      assert.equal(res.status, 403);
    });
  });

  it('returns 401 when not authenticated', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/location/users/location`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(locationBody),
      });
      assert.equal(res.status, 401);
    });
  });

  it('returns 200 when the body userId matches the token id (mocked db)', async () => {
    setAuthUser(REGULAR_USER);
    dbState.selectResult = [];
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/location/users/location`, {
        method: 'POST',
        headers: jsonHeaders({ authorization: 'Bearer user-token' }),
        body: JSON.stringify(locationBody),
      });
      const body = (await res.json()) as { success: boolean };
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.deepEqual((dbState.insertValues as Record<string, unknown>).firebaseUid, 'user-42');
    });
  });
});
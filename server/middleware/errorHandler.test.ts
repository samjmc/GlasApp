/**
 * The central error handler: every error a route throws becomes one `{ success:false, error:{ code, message } }`
 * answer, with the right status, and an unexpected error never shows its own text outside development.
 */
import type { Server } from 'node:http';
import express from 'express';
import { z } from 'zod';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.LOG_LEVEL = 'silent';

const { errorHandler } = await import('./errorHandler');
const { AppError } = await import('../utils/errors');
const { ConsentRequiredError } = await import('../account/consentError');
const { logger } = await import('../utils/logger');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.get('/app-error', () => {
    throw new AppError(409, 'CONFLICT', 'That session has ended');
  });
  app.get('/zod', async () => {
    z.object({ optionKey: z.enum(['option_a']) }).parse({ optionKey: 'option_z' });
  });
  app.get('/consent', async () => {
    throw new ConsentRequiredError();
  });
  app.get('/unique', async () => {
    throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
  });
  app.get('/crash', async () => {
    throw new Error('database exploded: password=hunter2');
  });
  app.post('/echo', (req, res) => res.json(req.body));
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const get = async (path: string) => {
  const res = await fetch(base + path, { headers: { connection: 'close' } });
  return { status: res.status, body: await res.json() };
};
const post = async (body: string) => {
  const res = await fetch(`${base}/echo`, { method: 'POST', headers: { 'content-type': 'application/json', connection: 'close' }, body });
  return { status: res.status, body: await res.json() };
};

describe('errorHandler', () => {
  it('answers an AppError with its own status, code and message', async () => {
    expect(await get('/app-error')).toEqual({
      status: 409,
      body: { success: false, error: { code: 'CONFLICT', message: 'That session has ended' } },
    });
  });

  it('answers a ZodError with 400 VALIDATION_ERROR and the first issue as the message', async () => {
    const { status, body } = await get('/zod');
    expect(status).toBe(400);
    expect(body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR', message: expect.stringContaining("Expected 'option_a'") } });
  });

  it('answers consent withdrawn mid-request with 403 CONSENT_REQUIRED, the code the client asks for consent on', async () => {
    const { status, body } = await get('/consent');
    expect(status).toBe(403);
    expect(body).toMatchObject({ success: false, error: { code: 'CONSENT_REQUIRED' } });
  });

  it("answers body-parser's errors as the caller's: 400 for broken JSON, 413 for a body over the limit", async () => {
    const broken = await post('{"optionKey":');
    expect(broken.status).toBe(400);
    expect(broken.body).toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });

    const huge = await post(JSON.stringify({ bio: 'x'.repeat(2048) }));
    expect(huge.status).toBe(413);
    expect(huge.body).toMatchObject({ success: false, error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('answers a unique violation with 409', async () => {
    expect(await get('/unique')).toMatchObject({ status: 409, body: { success: false, error: { code: 'DUPLICATE_RESOURCE' } } });
  });

  it("answers anything else with a 500 that does not carry the error's text, and logs it as an error", async () => {
    const logged = vi.spyOn(logger, 'error');
    const { status, body } = await get('/crash');
    expect(status).toBe(500);
    expect(body).toEqual({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('shows the real message in development only', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { body } = await get('/crash');
    expect(body.error.message).toBe('database exploded: password=hunter2');
  });

  it('logs a refusal as a warning, not an error', async () => {
    const errors = vi.spyOn(logger, 'error');
    const warnings = vi.spyOn(logger, 'warn');
    await get('/app-error');
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).toHaveBeenCalledTimes(1);
  });
});

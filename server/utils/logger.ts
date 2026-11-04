/**
 * Structured Logging
 * Central pino logger instance shared across the server, plus a helper
 * for obtaining the request-scoped logger attached by pino-http.
 *
 * Default log output is newline-delimited JSON (NDJSON). In development you
 * can pipe stdout through `pino-pretty` for human-readable output.
 */

import pino, { type Logger } from 'pino';
import type { Request } from 'express';

/** Never persist credentials / verification secrets in logs. */
export const logRedaction = {
  paths: [
    'password',
    'confirmPassword',
    'captchaToken',
    'verificationCode',
    'secret',
    'authorization',
    '*.password',
    '*.confirmPassword',
    '*.captchaToken',
    '*.verificationCode',
    '*.secret',
    'req.headers.authorization',
    'req.headers.cookie',
    // Job secret: pino-http logs every request header, and the jobs send it in these.
    'req.headers["x-admin-secret"]',
    'req.headers["x-cron-secret"]',
  ],
  censor: '[REDACTED]',
};

/**
 * An error as the log holds it: pino's serialisation, minus `body`. body-parser puts the raw text of a
 * request it could not parse on its error as `body` (up to the 1 MB limit: a bio, a free-text answer),
 * and the standard serialiser copies every own property of the error into the line.
 */
export function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    const out = pino.stdSerializers.err(err) as unknown as Record<string, unknown>;
    delete out.body;
    return out;
  }
  // pino-http hands a custom error serialiser the error ALREADY serialised by the stock one (it wraps ours),
  // so by then `body` is a plain property of a plain object with the serialiser's type/message/stack.
  if (typeof err === 'object' && err !== null && 'type' in err && 'message' in err && 'stack' in err) {
    const { body: _raw, ...rest } = err as Record<string, unknown>;
    return rest;
  }
  return err;
}

/** Shared pino logger instance for the server. */
export const logger: Logger = pino({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: logRedaction,
  serializers: {
    err: serializeError,
  },
});

/**
 * Return the request-scoped logger attached by pino-http (which binds the
 * request id and per-request fields), falling back to the shared logger when
 * pino-http has not been wired up (e.g. in unit tests).
 */
/** Return the request-scoped logger for a request. */
export function requestLogger(req: Request): Logger {
  return (req as Request & { log?: Logger }).log ?? logger;
}
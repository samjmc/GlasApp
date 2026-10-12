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

/** What pino blanks out of every log line. Exported so the test can check the real paths. */
export const LOG_REDACT = {
  // Never persist credentials / verification secrets in logs.
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
    // A visitor's IP address and browser. The privacy policy promises IP addresses do not
    // outlive 90 days, and container logs rotate by size, so at low traffic they could.
    'req.headers["x-forwarded-for"]',
    'req.headers["user-agent"]',
    'req.remoteAddress',
  ],
  censor: '[REDACTED]',
};

/**
 * A request as pino-http logs it, without the query string: that can carry a one-time token (the
 * reset-password link's `token_hash`), which no redact path can catch inside `url`.
 */
export function logRequest<R extends { url?: string; query?: unknown }>(req: R): Omit<R, 'query'> {
  const { query: _query, ...rest } = req;
  return { ...rest, url: req.url?.split('?')[0] };
}

/** Shared pino logger instance for the server. */
export const logger: Logger = pino({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: LOG_REDACT,
  serializers: {
    err: pino.stdSerializers.err,
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
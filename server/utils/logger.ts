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

/** Shared pino logger instance for the server. */
export const logger: Logger = pino({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
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
    ],
    censor: '[REDACTED]',
  },
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
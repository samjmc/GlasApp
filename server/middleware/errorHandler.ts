/**
 * The one place an error becomes a response. Mounted after every route (server/index.ts); Express 5
 * sends it a rejected async handler as well as a thrown error, so handlers just throw.
 *
 *   AppError                status, code and message as thrown
 *   ZodError                400 VALIDATION_ERROR with the first issue's message
 *   ConsentRequiredError    403 CONSENT_REQUIRED (consent withdrawn after the guard let the request in)
 *   body-parser errors      400 INVALID_INPUT, 413 PAYLOAD_TOO_LARGE
 *   anything else           500 INTERNAL_ERROR, without the error's own text outside development
 *
 * Every answer is `{ success: false, error: { code, message } }` (formatError).
 */

import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ConsentRequiredError, sendConsentRequired } from '../account/consentError';
import { AppError } from '../utils/errors';
import { formatError, ErrorCodes, type ErrorResponse } from '../utils/responseFormatters';
import { requestLogger } from '../utils/logger';

/**
 * Route params as plain strings. Express 5 types a param as `string | string[]` because a
 * `*splat` wildcard captures an array; no route wrapped here uses one, so each is a string.
 */
type StringParamsRequest = Request<Record<string, string>>;

// Type for async route handler functions
export type AsyncRouteHandler = (
  req: StringParamsRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | Promise<any>;

/** body-parser's own errors (http-errors): a 4xx `status` with `expose` set, meaning the message is safe to show. */
function isClientHttpError(err: unknown): err is Error & { status: number } {
  const { status, expose } = (err ?? {}) as { status?: unknown; expose?: unknown };
  return err instanceof Error && typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}

function toResponse(err: unknown): { status: number; body: ErrorResponse } {
  if (err instanceof AppError) return { status: err.status, body: formatError(err.code, err.message) };
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? ErrorCodes.VALIDATION_ERROR;
    return { status: 400, body: formatError('VALIDATION_ERROR', message, { errors: err.issues }) };
  }
  if (isClientHttpError(err)) {
    return { status: err.status, body: formatError(err.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_INPUT', err.message) };
  }

  const pgCode = (err as { code?: unknown } | null)?.code;
  if (pgCode === '23505') return { status: 409, body: formatError('DUPLICATE_RESOURCE', ErrorCodes.DUPLICATE_RESOURCE) };
  if (pgCode === '23503') return { status: 400, body: formatError('INVALID_REFERENCE', 'Referenced resource does not exist') };

  // Unknown: the error's own text can hold SQL, a stack or a person's data, so it is shown only in
  // development. formatError() additionally strips `details` whenever NODE_ENV=production.
  const shown = process.env.NODE_ENV === 'development' && err instanceof Error ? err : null;
  return {
    status: 500,
    body: formatError('INTERNAL_ERROR', shown?.message ?? ErrorCodes.INTERNAL_ERROR, shown?.stack ? { stack: shown.stack } : undefined),
  };
}

/** Express error-handling middleware. Register it after every route. */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Part of the answer is already sent: only Express's own handler can end it (it closes the connection).
  if (res.headersSent) return next(err);
  // Consent was withdrawn after requirePoliticalConsent let the request in. Nothing was stored.
  if (err instanceof ConsentRequiredError) return sendConsentRequired(res);

  const { status, body } = toResponse(err);
  // The path only: a query string can carry a person's choices.
  const fields = { err, path: req.path, method: req.method, userId: req.user?.id ?? 'anonymous', status };
  if (status >= 500) requestLogger(req).error(fields, 'Request failed');
  else requestLogger(req).warn(fields, 'Request refused');

  res.status(status).json(body);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch promise rejections and pass them to errorHandler
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(formatSuccess(data));
 *   }));
 *
 * @param fn - Async route handler function
 * @returns Wrapped function that catches errors
 */
/** Wrap an async route handler to forward errors. */
export const asyncHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as StringParamsRequest, res, next)).catch(next);
  };
};

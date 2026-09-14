/**
 * Centralized Error Handler Middleware
 * Catches all errors and returns consistent JSON responses
 * Works with asyncHandler wrapper to ensure all async errors are caught
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { formatError, ErrorCodes } from '../utils/responseFormatters';
import { requestLogger } from '../utils/logger';

// Type for async route handler functions
export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | Promise<any>;

/**
 * Error handler middleware
 * Should be registered AFTER all routes
 * Handles all error types and returns consistent JSON responses
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const log = requestLogger(req);
  const userId =
    (req as any).user?.id ?? (req as any).session?.userId ?? 'anonymous';

  // Log full error details server-side (never exposed to the client)
  log.error(
    {
      err,
      path: req.path,
      method: req.method,
      userId,
    },
    'Request failed'
  );

  // Handle known AppError instances
  if (err instanceof AppError) {
    const details = (err as AppError & { details?: unknown }).details;
    return res.status(err.statusCode).json(
      formatError(
        err.code,
        err.message,
        details !== undefined
          ? (details as Record<string, unknown>)
          : undefined
      )
    );
  }

  // Handle Zod validation errors (from zod-validation-error package)
  if (err.name === 'ZodError') {
    return res.status(400).json(
      formatError('VALIDATION_ERROR', ErrorCodes.VALIDATION_ERROR, {
        errors: (err as any).errors,
      })
    );
  }

  // Handle database constraint errors
  const errWithCode = err as any;
  if (errWithCode.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json(
      formatError('DUPLICATE_RESOURCE', ErrorCodes.DUPLICATE_RESOURCE)
    );
  }

  if (errWithCode.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json(
      formatError('INVALID_REFERENCE', 'Referenced resource does not exist')
    );
  }

  // Handle Express validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json(
      formatError('VALIDATION_ERROR', err.message)
    );
  }

  // Unknown error - don't leak details to clients outside development.
  // formatError() additionally strips `details` whenever NODE_ENV=production.
  const isDevelopment = process.env.NODE_ENV === 'development';

  return res.status(500).json(
    formatError(
      'INTERNAL_ERROR',
      isDevelopment ? err.message : ErrorCodes.INTERNAL_ERROR,
      isDevelopment ? { stack: err.stack } : undefined
    )
  );
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
export const asyncHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 * Should be registered BEFORE errorHandler but AFTER all routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json(
    formatError('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`)
  );
};


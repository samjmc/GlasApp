/**
 * Centralized Error Handler Middleware
 * Catches all errors and returns consistent JSON responses
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * Error handler middleware
 * Should be registered AFTER all routes
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error details (but don't expose to client)
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: (req as any).user?.id || 'anonymous',
  };

  console.error('🚨 Error occurred:', errorLog);

  // Handle known AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      }
    });
  }

  // Handle Zod validation errors (from zod-validation-error package)
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: (err as any).errors,
      }
    });
  }

  // Handle database constraint errors
  if ((err as any).code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      error: {
        message: 'Resource already exists',
        code: 'DUPLICATE_RESOURCE',
      }
    });
  }

  if ((err as any).code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      error: {
        message: 'Referenced resource does not exist',
        code: 'INVALID_REFERENCE',
      }
    });
  }

  // Handle Express validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        message: err.message,
        code: 'VALIDATION_ERROR',
      }
    });
  }

  // Unknown error - don't leak details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return res.status(500).json({
    success: false,
    error: {
      message: isDevelopment ? err.message : 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      ...(isDevelopment && { stack: err.stack }),
    }
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch promise rejections
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 * Should be registered BEFORE errorHandler but AFTER all routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
    }
  });
};


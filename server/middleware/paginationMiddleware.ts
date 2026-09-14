/**
 * Pagination Middleware
 * Extracts and validates pagination parameters from request query strings
 * Supports both offset-based and cursor-based pagination
 */

import { Request, Response, NextFunction } from 'express';

export interface PaginationOptions {
  maxLimit?: number;
  defaultLimit?: number;
  allowCursor?: boolean;
  allowOffset?: boolean;
}

export interface PaginationParams {
  limit: number;
  offset: number;
  cursor?: string | null;
  hasMore?: boolean;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_LIMIT = 100;

/**
 * Extract and validate pagination parameters from request query
 * Supports both offset-based pagination (limit + offset) and cursor-based pagination
 *
 * @param query - Express request.query object
 * @param options - Configuration options
 * @returns Validated pagination parameters
 *
 * @example
 * // Offset-based pagination
 * const paged = extractPagination(req.query, { maxLimit: 50 });
 * // Returns: { limit: 20, offset: 0, cursor: null }
 *
 * @example
 * // Cursor-based pagination
 * const paged = extractPagination(req.query, { allowCursor: true });
 * // Returns: { limit: 20, offset: 0, cursor: 'abc123', hasMore: false }
 */
/** Extract and validate pagination params from a request. */
export function extractPagination(
  query: Record<string, string | string[] | undefined>,
  options: PaginationOptions = {}
): PaginationParams {
  const {
    maxLimit = DEFAULT_MAX_LIMIT,
    defaultLimit = DEFAULT_LIMIT,
    allowCursor = true,
    allowOffset = true,
  } = options;

  // Extract limit parameter
  let limit = defaultLimit;
  if (query.limit) {
    const limitValue = Array.isArray(query.limit) ? query.limit[0] : query.limit;
    const parsedLimit = parseInt(limitValue, 10);

    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, maxLimit);
    }
  }

  // Extract offset parameter (for offset-based pagination)
  let offset = 0;
  if (allowOffset && query.offset) {
    const offsetValue = Array.isArray(query.offset) ? query.offset[0] : query.offset;
    const parsedOffset = parseInt(offsetValue, 10);

    if (!isNaN(parsedOffset) && parsedOffset >= 0) {
      offset = parsedOffset;
    }
  }

  // Extract cursor parameter (for cursor-based pagination)
  let cursor: string | null = null;
  if (allowCursor && query.cursor) {
    const cursorValue = Array.isArray(query.cursor) ? query.cursor[0] : query.cursor;
    if (cursorValue && cursorValue.trim()) {
      cursor = cursorValue;
    }
  }

  return {
    limit,
    offset,
    cursor: cursor || null,
  };
}

/**
 * Encode an ID into a cursor string
 * Used for cursor-based pagination
 *
 * @param id - The record ID to encode
 * @returns Base64-encoded cursor string
 *
 * @example
 * const cursor = buildCursorFromId(123);
 * // Returns: "MTIz" (base64 of "123")
 */
/** Encode an ID into a base64 cursor string. */
export function buildCursorFromId(id: string | number): string {
  const idString = String(id);
  return Buffer.from(idString).toString('base64');
}

/**
 * Decode a cursor string back to an ID
 * Used for cursor-based pagination
 *
 * @param cursor - The base64-encoded cursor string
 * @returns Decoded ID string, or null if cursor is invalid
 *
 * @example
 * const id = decodeCursor('MTIz');
 * // Returns: "123"
 */
/** Decode a base64 cursor string back to an ID. */
export function decodeCursor(cursor: string): string | null {
  // Buffer.from(..., 'base64') silently ignores invalid characters instead of
  // throwing, so malformed cursors must be rejected before decoding.
  if (!cursor || !/^[A-Za-z0-9+/]+={0,2}$/.test(cursor)) {
    return null;
  }
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    // Validate that it's a valid number/ID format
    if (decoded && decoded.trim()) {
      return decoded;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to automatically extract pagination parameters from query
 * Attaches pagination info to req object for use in route handlers
 *
 * @example
 * app.use(paginationMiddleware());
 *
 * router.get('/items', (req, res) => {
 *   const { limit, offset, cursor } = req.pagination;
 * });
 */
/** Express middleware extracting pagination params from the query. */
export const paginationMiddleware = (options: PaginationOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.pagination = extractPagination(req.query as Record<string, string | string[] | undefined>, options);
    next();
  };
};

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}

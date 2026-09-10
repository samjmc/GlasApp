/**
 * Response Formatters
 * Standardized response formatting for success and error responses across all routes
 * Replaces 3+ inconsistent response patterns found in existing routes
 */

export interface SuccessResponseMeta {
  [key: string]: unknown;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: SuccessResponseMeta;
}

export interface ErrorDetails {
  [key: string]: unknown;
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: ErrorDetails;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Format a success response with optional metadata
 * Standardizes success response format across all routes
 *
 * @param data - The response data payload
 * @param meta - Optional metadata (pagination, timestamps, etc.)
 * @returns Formatted success response
 *
 * @example
 * // Simple success response
 * return formatSuccess(user);
 * // Returns: { success: true, data: user }
 *
 * @example
 * // Success with pagination metadata
 * return formatSuccess(articles, {
 *   pagination: { limit: 20, offset: 0, total: 150, hasMore: true }
 * });
 * // Returns: { success: true, data: articles, meta: { pagination: {...} } }
 *
 * @example
 * // Success with timestamps
 * return formatSuccess(results, { fetchedAt: new Date().toISOString() });
 * // Returns: { success: true, data: results, meta: { fetchedAt: "2026-09-10T..." } }
 */
export function formatSuccess<T>(data: T, meta?: SuccessResponseMeta): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta && Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return response;
}

/**
 * Format an error response with standardized structure
 * Replaces inconsistent error response patterns
 *
 * @param code - Error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND', 'DATABASE_ERROR')
 * @param message - User-facing error message
 * @param details - Optional additional error details for debugging
 * @returns Formatted error response
 *
 * @example
 * // Basic error
 * return formatError('NOT_FOUND', 'Article not found');
 * // Returns: { success: false, error: { message: 'Article not found', code: 'NOT_FOUND' } }
 *
 * @example
 * // Error with details
 * return formatError('VALIDATION_ERROR', 'Invalid input', {
 *   field: 'email',
 *   reason: 'Invalid email format'
 * });
 * // Returns: { success: false, error: { message: 'Invalid input', code: 'VALIDATION_ERROR', details: {...} } }
 */
export function formatError(
  code: string,
  message: string,
  details?: ErrorDetails
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      code,
    },
  };

  if (details && Object.keys(details).length > 0) {
    response.error.details = details;
  }

  return response;
}

/**
 * Common error codes and their default messages
 * Use these standardized codes across the application
 */
export const ErrorCodes = {
  // Validation errors (400)
  VALIDATION_ERROR: 'Validation failed',
  INVALID_INPUT: 'Invalid input provided',
  MISSING_REQUIRED_FIELD: 'Required field is missing',

  // Authentication errors (401)
  UNAUTHORIZED: 'Unauthorized - please log in',
  INVALID_CREDENTIALS: 'Invalid email or password',
  SESSION_EXPIRED: 'Session has expired',
  TOKEN_INVALID: 'Authentication token is invalid',

  // Authorization errors (403)
  FORBIDDEN: 'Forbidden - you do not have permission',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this operation',

  // Not found errors (404)
  NOT_FOUND: 'Resource not found',
  ENTITY_NOT_FOUND: 'Entity not found',

  // Conflict errors (409)
  CONFLICT: 'Resource already exists',
  DUPLICATE_RESOURCE: 'Duplicate resource',
  STATE_CONFLICT: 'State conflict - resource has been modified',

  // Rate limit errors (429)
  RATE_LIMITED: 'Too many requests - please try again later',

  // Server errors (500)
  INTERNAL_ERROR: 'An unexpected error occurred',
  DATABASE_ERROR: 'Database error',
  EXTERNAL_SERVICE_ERROR: 'External service error',
  OPERATION_FAILED: 'Operation failed',
} as const;

/**
 * Format a paginated success response
 * Convenience function combining formatSuccess with pagination metadata
 *
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @returns Formatted success response with pagination
 *
 * @example
 * const articles = [{ id: 1, title: 'Article 1' }, ...];
 * return formatPaginatedSuccess(articles, {
 *   limit: 20,
 *   offset: 0,
 *   total: 150,
 *   hasMore: true
 * });
 */
export function formatPaginatedSuccess<T>(
  data: T[],
  pagination: Record<string, unknown>
): SuccessResponse<T[]> {
  return formatSuccess(data, { pagination });
}

/**
 * Map HTTP status codes to error codes
 * Useful for consistent error formatting in error handler
 */
export const StatusCodeToErrorCode: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'EXTERNAL_SERVICE_ERROR',
};

/**
 * Get default error message for a given status code
 * @param statusCode - HTTP status code
 * @returns Default error message
 */
export function getDefaultErrorMessage(statusCode: number): string {
  const codeKey = StatusCodeToErrorCode[statusCode];
  if (codeKey && ErrorCodes[codeKey as keyof typeof ErrorCodes]) {
    return ErrorCodes[codeKey as keyof typeof ErrorCodes];
  }
  return 'An error occurred';
}

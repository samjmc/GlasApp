/**
 * Tests for Response Formatters
 * Tests success and error response formatting
 */

import {
  formatSuccess,
  formatError,
  formatPaginatedSuccess,
  ErrorCodes,
  getDefaultErrorMessage,
  StatusCodeToErrorCode,
} from '../../../server/utils/responseFormatters';

describe('Response Formatters', () => {
  describe('formatSuccess', () => {
    it('should format simple success response', () => {
      const data = { id: 1, name: 'Test User' };
      const response = formatSuccess(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toBeUndefined();
    });

    it('should format success response with metadata', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const meta = {
        pagination: { limit: 20, offset: 0, total: 2 },
        fetchedAt: new Date().toISOString(),
      };
      const response = formatSuccess(data, meta);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toEqual(meta);
    });

    it('should not include empty metadata', () => {
      const data = { id: 1 };
      const response = formatSuccess(data, {});

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toBeUndefined();
    });

    it('should handle null data', () => {
      const response = formatSuccess(null);

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it('should handle empty array data', () => {
      const response = formatSuccess([]);

      expect(response.success).toBe(true);
      expect(response.data).toEqual([]);
    });

    it('should handle nested metadata', () => {
      const data = { result: 'ok' };
      const meta = {
        timing: {
          queriedAt: new Date().toISOString(),
          executionMs: 125,
        },
      };
      const response = formatSuccess(data, meta);

      expect(response.meta?.timing?.executionMs).toBe(125);
    });

    it('should handle complex data objects', () => {
      const data = {
        user: { id: 1, email: 'test@example.com' },
        stats: { loginCount: 5 },
        settings: { theme: 'dark' },
      };
      const response = formatSuccess(data);

      expect(response.data).toEqual(data);
    });
  });

  describe('formatError', () => {
    it('should format basic error response', () => {
      const response = formatError('NOT_FOUND', 'Article not found');

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('NOT_FOUND');
      expect(response.error.message).toBe('Article not found');
      expect(response.error.details).toBeUndefined();
    });

    it('should format error with details', () => {
      const response = formatError(
        'VALIDATION_ERROR',
        'Input validation failed',
        { field: 'email', reason: 'Invalid format' }
      );

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.message).toBe('Input validation failed');
      expect(response.error.details).toEqual({
        field: 'email',
        reason: 'Invalid format',
      });
    });

    it('should not include empty details', () => {
      const response = formatError('INTERNAL_ERROR', 'Server error', {});

      expect(response.success).toBe(false);
      expect(response.error.details).toBeUndefined();
    });

    it('should handle multi-field validation errors', () => {
      const response = formatError(
        'VALIDATION_ERROR',
        'Multiple fields failed validation',
        {
          errors: [
            { field: 'email', message: 'Invalid format' },
            { field: 'password', message: 'Too short' },
          ],
        }
      );

      expect(response.error.details?.errors).toHaveLength(2);
    });

    it('should handle common error codes', () => {
      const testCases = [
        ['NOT_FOUND', 'Resource not found'],
        ['UNAUTHORIZED', 'Authentication required'],
        ['FORBIDDEN', 'Access denied'],
        ['VALIDATION_ERROR', 'Validation failed'],
        ['DATABASE_ERROR', 'Database operation failed'],
      ];

      testCases.forEach(([code, message]) => {
        const response = formatError(code, message);
        expect(response.error.code).toBe(code);
      });
    });
  });

  describe('formatPaginatedSuccess', () => {
    it('should format paginated success response', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const pagination = {
        limit: 20,
        offset: 0,
        total: 50,
        hasMore: true,
      };
      const response = formatPaginatedSuccess(data, pagination);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta?.pagination).toEqual(pagination);
    });

    it('should work with cursor pagination', () => {
      const data = [{ id: 1 }];
      const pagination = {
        limit: 20,
        cursor: 'abc123',
        hasMore: true,
      };
      const response = formatPaginatedSuccess(data, pagination);

      expect(response.meta?.pagination?.cursor).toBe('abc123');
      expect(response.meta?.pagination?.hasMore).toBe(true);
    });

    it('should handle empty results', () => {
      const response = formatPaginatedSuccess([], {
        limit: 20,
        offset: 0,
        total: 0,
        hasMore: false,
      });

      expect(response.data).toEqual([]);
      expect(response.meta?.pagination?.hasMore).toBe(false);
    });
  });

  describe('ErrorCodes constants', () => {
    it('should define common validation error codes', () => {
      expect(ErrorCodes.VALIDATION_ERROR).toBeDefined();
      expect(ErrorCodes.INVALID_INPUT).toBeDefined();
      expect(ErrorCodes.MISSING_REQUIRED_FIELD).toBeDefined();
    });

    it('should define authentication error codes', () => {
      expect(ErrorCodes.UNAUTHORIZED).toBeDefined();
      expect(ErrorCodes.INVALID_CREDENTIALS).toBeDefined();
      expect(ErrorCodes.SESSION_EXPIRED).toBeDefined();
    });

    it('should define authorization error codes', () => {
      expect(ErrorCodes.FORBIDDEN).toBeDefined();
      expect(ErrorCodes.INSUFFICIENT_PERMISSIONS).toBeDefined();
    });

    it('should define not found error codes', () => {
      expect(ErrorCodes.NOT_FOUND).toBeDefined();
      expect(ErrorCodes.ENTITY_NOT_FOUND).toBeDefined();
    });

    it('should define conflict error codes', () => {
      expect(ErrorCodes.CONFLICT).toBeDefined();
      expect(ErrorCodes.DUPLICATE_RESOURCE).toBeDefined();
    });

    it('should define server error codes', () => {
      expect(ErrorCodes.INTERNAL_ERROR).toBeDefined();
      expect(ErrorCodes.DATABASE_ERROR).toBeDefined();
      expect(ErrorCodes.EXTERNAL_SERVICE_ERROR).toBeDefined();
    });
  });

  describe('getDefaultErrorMessage', () => {
    it('should get message for 400 status', () => {
      const message = getDefaultErrorMessage(400);
      expect(message).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('should get message for 401 status', () => {
      const message = getDefaultErrorMessage(401);
      expect(message).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('should get message for 403 status', () => {
      const message = getDefaultErrorMessage(403);
      expect(message).toBe(ErrorCodes.FORBIDDEN);
    });

    it('should get message for 404 status', () => {
      const message = getDefaultErrorMessage(404);
      expect(message).toBe(ErrorCodes.NOT_FOUND);
    });

    it('should get message for 500 status', () => {
      const message = getDefaultErrorMessage(500);
      expect(message).toBe(ErrorCodes.INTERNAL_ERROR);
    });

    it('should handle unknown status codes', () => {
      const message = getDefaultErrorMessage(418); // I'm a teapot
      expect(message).toBe('An error occurred');
    });
  });

  describe('StatusCodeToErrorCode mapping', () => {
    it('should map all HTTP status codes to error codes', () => {
      expect(StatusCodeToErrorCode[400]).toBe('VALIDATION_ERROR');
      expect(StatusCodeToErrorCode[401]).toBe('UNAUTHORIZED');
      expect(StatusCodeToErrorCode[403]).toBe('FORBIDDEN');
      expect(StatusCodeToErrorCode[404]).toBe('NOT_FOUND');
      expect(StatusCodeToErrorCode[409]).toBe('CONFLICT');
      expect(StatusCodeToErrorCode[500]).toBe('INTERNAL_ERROR');
    });
  });

  describe('real-world scenarios', () => {
    it('should format news feed success response', () => {
      const articles = [
        { id: 1, title: 'Breaking News', score: 0.95 },
        { id: 2, title: 'Analysis', score: 0.87 },
      ];
      const response = formatPaginatedSuccess(articles, {
        limit: 20,
        offset: 0,
        total: 150,
        hasMore: true,
      });

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.meta?.pagination?.total).toBe(150);
    });

    it('should format quiz result success response', () => {
      const result = {
        userId: 'user-123',
        scores: { economic: 65, social: 72 },
        ideology: 'centrist',
      };
      const response = formatSuccess(result, {
        calculatedAt: new Date().toISOString(),
      });

      expect(response.data.ideology).toBe('centrist');
    });

    it('should format validation error for quiz submission', () => {
      const response = formatError(
        'VALIDATION_ERROR',
        'Quiz submission validation failed',
        {
          missingAnswers: [1, 3, 5],
          invalidAnswerFormat: [2],
        }
      );

      expect(response.error.details?.missingAnswers).toEqual([1, 3, 5]);
    });

    it('should format authentication error', () => {
      const response = formatError('UNAUTHORIZED', ErrorCodes.UNAUTHORIZED);

      expect(response.error.code).toBe('UNAUTHORIZED');
      expect(response.success).toBe(false);
    });

    it('should format database error with context', () => {
      const response = formatError(
        'DATABASE_ERROR',
        'Failed to save user activity',
        {
          operation: 'insert',
          table: 'user_activity',
          originalError: 'Connection timeout',
        }
      );

      expect(response.error.code).toBe('DATABASE_ERROR');
      expect(response.error.details?.table).toBe('user_activity');
    });

    it('should format paginated debates response', () => {
      const debates = [
        { id: 1, title: 'Climate Policy', date: '2026-09-10' },
        { id: 2, title: 'Housing Crisis', date: '2026-09-09' },
      ];
      const response = formatPaginatedSuccess(debates, {
        limit: 10,
        offset: 20,
        total: 500,
        hasMore: true,
      });

      expect(response.meta?.pagination?.offset).toBe(20);
      expect(response.meta?.pagination?.total).toBe(500);
    });
  });

  describe('type safety', () => {
    it('should maintain type information for success response', () => {
      interface User {
        id: number;
        name: string;
      }

      const user: User = { id: 1, name: 'Alice' };
      const response = formatSuccess<User>(user);

      // TypeScript would ensure this compiles
      expect(response.data.id).toBe(1);
      expect(response.data.name).toBe('Alice');
    });

    it('should handle array types in success response', () => {
      interface Article {
        id: number;
        title: string;
      }

      const articles: Article[] = [
        { id: 1, title: 'News 1' },
        { id: 2, title: 'News 2' },
      ];

      const response = formatSuccess<Article[]>(articles);
      expect(response.data).toHaveLength(2);
    });
  });
});

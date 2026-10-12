import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatError, formatSuccess } from './responseFormatters';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('formatSuccess', () => {
  it('wraps the data, and adds meta only when it has keys', () => {
    expect(formatSuccess({ id: 1 })).toEqual({ success: true, data: { id: 1 } });
    expect(formatSuccess([], {})).toEqual({ success: true, data: [] });
    expect(formatSuccess(null, { total: 2 })).toEqual({ success: true, data: null, meta: { total: 2 } });
  });
});

describe('formatError', () => {
  it('carries code and message, and details only when there are any', () => {
    expect(formatError('NOT_FOUND', 'Article not found')).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    expect(formatError('INTERNAL_ERROR', 'x', {}).error).not.toHaveProperty('details');
    expect(formatError('INTERNAL_ERROR', 'x', '').error).not.toHaveProperty('details');
    expect(formatError('VALIDATION_ERROR', 'x', { field: 'email' }).error.details).toEqual({ field: 'email' });
  });

  it('never sends details in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(formatError('VALIDATION_ERROR', 'x', { field: 'email' }).error).not.toHaveProperty('details');
  });
});

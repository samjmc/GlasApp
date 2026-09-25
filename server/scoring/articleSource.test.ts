import { describe, expect, it, vi } from 'vitest';

// articleSource imports the news repository, which imports db (throws without DATABASE_URL).
vi.mock('../news/repository', () => ({}));
const { toOutcome } = await import('./articleSource');

const base = { importanceScore: 62, importanceReasoning: 'Cabinet decision', scoreApplied: false };

describe('toOutcome', () => {
  it('a finished article is scored, even when no TD matched', () => {
    expect(toOutcome({ ...base, scoreApplied: true }).status).toBe('scored');
    expect(toOutcome(base).status).toBe('scored');
  });
  it('a skip reason makes it skipped and is kept', () => {
    expect(toOutcome({ ...base, skippedReason: 'Duplicate of article 4' })).toEqual({
      status: 'skipped',
      importanceScore: 62,
      importanceReasoning: 'Cabinet decision',
      skipReason: 'Duplicate of article 4',
      errorMessage: null,
    });
  });
  it('a same-event duplicate is `duplicate`, keeping its reason', () => {
    expect(toOutcome({ ...base, skippedReason: 'Duplicate of article 4 (same event: budget)', duplicateOf: 4 })).toMatchObject({
      status: 'duplicate',
      skipReason: 'Duplicate of article 4 (same event: budget)',
    });
  });
  it('an error wins over a duplicate', () => {
    expect(toOutcome({ ...base, duplicateOf: 4, errorMessage: 'db down' }).status).toBe('failed');
  });
  it('an error wins over a skip', () => {
    expect(toOutcome({ ...base, skippedReason: 'x', errorMessage: 'panel timeout' }).status).toBe('failed');
  });
});

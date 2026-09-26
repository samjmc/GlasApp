import { describe, expect, it, vi } from 'vitest';

// articleSource imports the news repository, which imports db (throws without DATABASE_URL).
vi.mock('./repository', () => ({}));
const { toOutcome } = await import('./articleSource');

const base = { importanceScore: 62, importanceReasoning: 'Cabinet decision' };

describe('toOutcome', () => {
  it('a finished article is scored, even when no TD matched', () => {
    expect(toOutcome(base).status).toBe('scored');
  });
  it('a skip reason makes it skipped and is kept', () => {
    expect(toOutcome({ ...base, skippedReason: 'Below 25th percentile (score: 30)' })).toEqual({
      status: 'skipped',
      importanceScore: 62,
      importanceReasoning: 'Cabinet decision',
      skipReason: 'Below 25th percentile (score: 30)',
      errorMessage: null,
    });
  });
  it('an error wins over a skip', () => {
    expect(toOutcome({ ...base, skippedReason: 'x', errorMessage: 'extraction timeout' }).status).toBe('failed');
  });
});

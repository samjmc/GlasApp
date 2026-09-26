import { describe, expect, it, vi } from 'vitest';

// Importing the job must not run it or reach a database; its selection SQL is covered by
// server/stances/stances.integration.test.ts.
vi.mock('../db', () => ({ shutdown: vi.fn() }));
vi.mock('../ideology', () => ({ deleteTdEvidence: vi.fn(), recalculateAll: vi.fn() }));
vi.mock('../services/aiService', () => ({ isLLMConfigured: () => false }));
vi.mock('../stances', () => ({ emptyStanceStats: vi.fn(), rebuildArticles: vi.fn(), recordStances: vi.fn(), toCandidate: vi.fn() }));
vi.mock('../voting', () => ({ completeJson: vi.fn(), questionForArticle: vi.fn() }));

const { parseArgs } = await import('./stances');

describe('npm run stances', () => {
  it('needs --rebuild, and defaults to 180 days, writing', () => {
    expect(() => parseArgs([])).toThrow(/--rebuild/);
    expect(parseArgs(['--rebuild'])).toEqual({ days: 180, dryRun: false });
  });

  it('reads --days and --dry-run', () => {
    expect(parseArgs(['--rebuild', '--days', '30', '--dry-run'])).toEqual({ days: 30, dryRun: true });
  });

  it('refuses a --days that is not a positive whole number', () => {
    for (const bad of [[], ['0'], ['-5'], ['1.5'], ['abc']]) {
      expect(() => parseArgs(['--rebuild', '--days', ...bad])).toThrow(/--days/);
    }
  });
});

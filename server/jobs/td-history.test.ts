import { describe, expect, it, vi } from 'vitest';

// Importing the job must not run it or reach a database; the pipeline is covered by
// server/tdHistory/tdHistory.integration.test.ts.
vi.mock('../db', () => ({ shutdown: vi.fn() }));
vi.mock('../services/aiService', () => ({ isLLMConfigured: () => false, chatProviderFrom: () => null }));
vi.mock('../tdHistory', () => ({}));
vi.mock('../voting', () => ({ completeJson: vi.fn(), QUESTION_MODEL: 'm' }));

const { parseArgs } = await import('./td-history');

describe('npm run td-history', () => {
  it('defaults to every TD, writing', () => {
    expect(parseArgs([])).toEqual({ td: null, limit: null, dryRun: false, force: false, remove: false });
  });

  it('reads --td, --limit, --dry-run and --force', () => {
    expect(parseArgs(['--td', '5', '--limit', '3', '--dry-run', '--force'])).toEqual({ td: 5, limit: 3, dryRun: true, force: true, remove: false });
  });

  it('rejects a bad number, an unknown flag, and --delete without --td', () => {
    expect(() => parseArgs(['--limit', '0'])).toThrow(/positive whole number/);
    expect(() => parseArgs(['--td', 'x'])).toThrow(/positive whole number/);
    expect(() => parseArgs(['--all'])).toThrow(/Unknown argument/);
    expect(() => parseArgs(['--delete'])).toThrow(/--delete needs --td/);
    expect(parseArgs(['--delete', '--td', '7']).remove).toBe(true);
  });
});

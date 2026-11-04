import { describe, expect, it, vi } from 'vitest';

// itemsJob reaches the database only through the runner it is given; nothing here connects.
vi.mock('../db', () => ({ db: {}, pool: {}, shutdown: vi.fn() }));
const { MAX_CONCURRENCY, itemsOptions } = await import('./itemsJob');

describe('npm run debates:items / questions:items flags', () => {
  it('refuses a bare command, which would read every unit', () => {
    expect(() => itemsOptions([])).toThrow(/--limit N, --pilot N, --debate <id>, or --all --yes/);
    expect(() => itemsOptions(['--all'])).toThrow(/--all --yes/);
    expect(() => itemsOptions(['--dry-run', '--force'])).toThrow(/--all --yes/);
  });

  it('runs with a limit, a pilot, named units, or --all --yes', () => {
    expect(itemsOptions(['--limit', '30'])).toMatchObject({ limit: 30, pilot: null, debateIds: undefined, concurrency: 2 });
    expect(itemsOptions(['--pilot', '50'])).toMatchObject({ pilot: 50 });
    expect(itemsOptions(['--debate', 'a', '--debate', 'b'])).toMatchObject({ debateIds: ['a', 'b'] });
    expect(itemsOptions(['--all', '--yes', '--force', '--dry-run'])).toEqual({
      debateIds: undefined,
      pilot: null,
      limit: null,
      concurrency: 2,
      force: true,
      dryRun: true,
    });
  });

  it(`caps --concurrency at ${MAX_CONCURRENCY}`, () => {
    expect(itemsOptions(['--limit', '5', '--concurrency', String(MAX_CONCURRENCY)]).concurrency).toBe(MAX_CONCURRENCY);
    expect(() => itemsOptions(['--limit', '5', '--concurrency', String(MAX_CONCURRENCY + 1)])).toThrow(/at most/);
  });
});

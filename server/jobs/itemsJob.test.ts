import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ shutdown: vi.fn() }));
vi.mock('../services/aiService', () => ({ isLLMConfigured: () => true }));
vi.mock('../parliament/debateItems/run', () => ({ costOf: vi.fn() }));
vi.mock('../parliament/debateItems/verify', () => ({ REJECT_REASONS: [] }));

const { parseArgs } = await import('./itemsJob');

describe('the items jobs’ flags', () => {
  it('reads one scope and the switches', () => {
    expect(parseArgs(['--limit', '20', '--dry-run'])).toMatchObject({ limit: 20, pilot: null, debateIds: undefined, dryRun: true, force: false, concurrency: 2 });
    expect(parseArgs(['--all', '--force', '--concurrency', '6'])).toMatchObject({ limit: null, pilot: null, debateIds: undefined, force: true, concurrency: 6 });
    expect(parseArgs(['--pilot', '5'])).toMatchObject({ pilot: 5 });
    // Every id after --debate, not only the first.
    expect(parseArgs(['--debate', 'a', 'b', '--dry-run'])).toMatchObject({ debateIds: ['a', 'b'], dryRun: true });
  });

  it('refuses a mistyped or empty flag rather than reading every unit', () => {
    for (const argv of [['--dry-run=true'], ['--dryrun', '--all'], ['--limit=20'], ['--limit'], ['--limit', '0'], ['--limit', 'x'], ['--debate'], ['--debate', '--all'], ['--all', '--concurrency', '-1']]) {
      expect(() => parseArgs(argv), argv.join(' ')).toThrow();
    }
  });

  it('needs exactly one scope', () => {
    for (const argv of [[], ['--dry-run'], ['--force'], ['--all', '--limit', '5'], ['--debate', 'x', '--pilot', '5']]) {
      expect(() => parseArgs(argv), argv.join(' ')).toThrow(/one of --all/);
    }
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Importing the job must not run it or reach a database; its selection SQL is covered by
// server/stances/stances.integration.test.ts, and the division modes' work by
// server/stances/divisions.integration.test.ts. Every stance call here is a stub.
const state = vi.hoisted(() => ({ llm: false }));
vi.mock('../db', () => ({ shutdown: vi.fn() }));
vi.mock('../ideology', () => ({ deleteTdEvidence: vi.fn(), recalculateAll: vi.fn() }));
vi.mock('../services/aiService', () => ({ isLLMConfigured: () => state.llm }));
vi.mock('../stances', () => ({
  emptyStanceStats: vi.fn(),
  rebuildArticles: vi.fn(),
  recordStances: vi.fn(),
  toCandidate: vi.fn(),
  classifyDivisions: vi.fn(async () => ({
    pending: 3,
    read: 1,
    calls: 2,
    statuses: { matched: 1, no_match: 0, no_candidates: 0, procedural: 0, rejected: 0, no_context: 0, failed: 0 },
    promptTokens: 1200,
    completionTokens: 300,
    readings: [
      {
        divisionId: 'dail-34-2026-09-24-vote_3',
        date: '2026-09-24',
        subject: 'Question put',
        status: 'matched',
        rejectReason: null,
        divisionKind: 'words_stand',
        taMeans: 'Keep the motion calling for public homes.',
        blocks: ['Q', 'M1', 'A1'],
        quoteBlock: 'M1',
        quote: 'calls on the Government to build public homes',
        candidates: 4,
        match: { questionId: 7, question: 'How should the State meet housing demand?', ta: 'Build public homes', nil: 'Leave it to the market', confidence: 0.8 },
        model: 'stub-model',
        error: null,
      },
    ],
  })),
  syncDivisionStances: vi.fn(async () => ({ divisions: 2, rows: 40, skipped: 0, evidence: 12, tds: 170, parties: 9 })),
  runDivisionAudit: vi.fn(async () => ({
    audit: { divisions: 1, agree: 1, total: 2, byDimension: { economic: { agree: 1, total: 2 } }, worst: [] },
    matched: [{ divisionId: 'dail-34-2026-09-24-vote_3', date: '2026-09-24', subject: 'Question put', divisionKind: 'words_stand', taMeans: 'Keep it.', quoteBlock: 'M1', quote: 'q', question: 'Q?', ta: 'Build public homes', nil: null, meaningConfidence: 0.8, matchConfidence: 0.9, url: 'https://www.oireachtas.ie/en/debates/vote/dail/34/2026-09-24/3/' }],
  })),
}));
vi.mock('../voting', () => ({ completeJson: vi.fn(), questionForArticle: vi.fn() }));

const stances = await import('../stances');
const { parseArgs, parseDivisionArgs, runDivisions } = await import('./stances');

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

describe('npm run stances -- --divisions: arguments', () => {
  it('reads each mode', () => {
    expect(parseDivisionArgs(['--divisions'])).toEqual({ mode: 'classify', dryRun: false, reclassify: false, limit: null, windowDays: null });
    // A dry run defaults to 20 divisions, so a forgotten --limit cannot spend a whole backfill.
    expect(parseDivisionArgs(['--divisions', '--dry-run'])).toEqual({ mode: 'classify', dryRun: true, reclassify: false, limit: 20, windowDays: null });
    expect(parseDivisionArgs(['--divisions', '--dry-run', '--limit', '5', '--window', '365'])).toEqual({ mode: 'classify', dryRun: true, reclassify: false, limit: 5, windowDays: 365 });
    expect(parseDivisionArgs(['--divisions', '--window', '365'])).toEqual({ mode: 'classify', dryRun: false, reclassify: false, limit: null, windowDays: 365 });
    expect(parseDivisionArgs(['--divisions', '--reclassify', '--limit', '40'])).toEqual({ mode: 'classify', dryRun: false, reclassify: true, limit: 40, windowDays: null });
    expect(parseDivisionArgs(['--divisions', '--audit'])).toEqual({ mode: 'audit' });
    expect(parseDivisionArgs(['--divisions', '--sync'])).toEqual({ mode: 'sync' });
  });

  it('refuses an unknown flag, and the rebuild flags, rather than starting a paid run', () => {
    expect(() => parseDivisionArgs(['--divisions', '--evidence'])).toThrow(/Unknown flag --evidence/);
    expect(() => parseDivisionArgs(['--divisions', '--rebuild'])).toThrow(/Unknown flag --rebuild/);
    expect(() => parseDivisionArgs(['--divisions', '--days', '30'])).toThrow(/Unknown flag --days/);
    expect(() => parseDivisionArgs(['--divisions', '--resample', '20'])).toThrow(/Unknown flag --resample/);
  });

  it('keeps each flag to its mode', () => {
    // The window changes which questions a division is matched to, so it goes with reading, never with audit or sync.
    expect(() => parseDivisionArgs(['--divisions', '--audit', '--window', '365'])).toThrow(/--window goes only with reading divisions/);
    expect(() => parseDivisionArgs(['--divisions', '--sync', '--window', '365'])).toThrow(/--window goes only with reading divisions/);
    for (const bad of ['0', '-5', '1.5', 'abc']) {
      expect(() => parseDivisionArgs(['--divisions', '--window', bad])).toThrow(/--window needs a positive whole number/);
    }
    expect(() => parseDivisionArgs(['--divisions', '--audit', '--sync'])).toThrow(/one of/);
    expect(() => parseDivisionArgs(['--divisions', '--sync', '--limit', '5'])).toThrow(/only with/);
    expect(() => parseDivisionArgs(['--divisions', '--audit', '--dry-run'])).toThrow(/only with/);
    for (const bad of [[], ['0'], ['-5'], ['1.5'], ['abc']]) {
      expect(() => parseDivisionArgs(['--divisions', '--limit', ...bad])).toThrow(/--limit/);
    }
  });
});

describe('npm run stances -- --divisions: what each mode runs', () => {
  const lines: string[] = [];
  const log = (line: string) => lines.push(line);
  beforeEach(() => {
    vi.clearAllMocks();
    lines.length = 0;
    state.llm = true;
  });

  it('--sync syncs and calls no model, even with no LLM configured', async () => {
    state.llm = false;
    await runDivisions(['--divisions', '--sync'], log);
    expect(stances.syncDivisionStances).toHaveBeenCalledTimes(1);
    expect(stances.classifyDivisions).not.toHaveBeenCalled();
    expect(lines.join('\n')).toContain('40 vote stance(s) from 2 matched division(s)');
  });

  it('--dry-run reads 20, writes nothing, and prints each reading, its match, its link and the token totals', async () => {
    await runDivisions(['--divisions', '--dry-run'], log);
    expect(stances.classifyDivisions).toHaveBeenCalledWith({ limit: 20, dryRun: true, reclassify: false, windowDays: undefined });
    expect(stances.syncDivisionStances).not.toHaveBeenCalled();
    const out = lines.join('\n');
    for (const text of [
      'dail-34-2026-09-24-vote_3',
      'words_stand',
      'Keep the motion calling for public homes.',
      'Q, M1, A1',
      '[M1] "calls on the Government to build public homes"',
      '4 candidate question(s)',
      'Tá: Build public homes | Níl: Leave it to the market (confidence 0.8)',
      'https://www.oireachtas.ie/en/debates/vote/dail/34/2026-09-24/3/',
    ]) {
      expect(out).toContain(text);
    }
    expect(out).toMatch(/\[dry run, nothing written\].*1200 prompt \+ 300 completion tokens/);
  });

  it('--divisions reads and stores, but writes no stance', async () => {
    await runDivisions(['--divisions', '--reclassify'], log);
    expect(stances.classifyDivisions).toHaveBeenCalledWith({ limit: null, dryRun: false, reclassify: true, windowDays: undefined });
    expect(stances.syncDivisionStances).not.toHaveBeenCalled();
  });

  it('--divisions --window passes the window to a real run', async () => {
    await runDivisions(['--divisions', '--window', '365'], log);
    expect(stances.classifyDivisions).toHaveBeenCalledWith({ limit: null, dryRun: false, reclassify: false, windowDays: 365 });
    expect(stances.syncDivisionStances).not.toHaveBeenCalled();
  });

  it('refuses to read divisions with no LLM configured', async () => {
    state.llm = false;
    await expect(runDivisions(['--divisions'], log)).rejects.toThrow(/No LLM/);
    expect(stances.classifyDivisions).not.toHaveBeenCalled();
  });

  it('--audit needs no model, and prints every matched division', async () => {
    state.llm = false;
    await runDivisions(['--divisions', '--audit'], log);
    expect(stances.runDivisionAudit).toHaveBeenCalledTimes(1);
    const out = lines.join('\n');
    expect(out).toMatch(/1 of 2.*50%/);
    expect(out).toContain('Tá: Build public homes | Níl: (none)');
    expect(out).toContain('https://www.oireachtas.ie/en/debates/vote/dail/34/2026-09-24/3/');
  });
});

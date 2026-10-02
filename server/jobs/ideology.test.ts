import { beforeEach, describe, expect, it, vi } from 'vitest';

// Importing the job must not run it, reach a database or call a model: every ideology call
// is a stub here. The division functions themselves are covered by
// server/ideology/divisions.integration.test.ts.
const state = vi.hoisted(() => ({ llm: false }));
vi.mock('../db', () => ({ shutdown: vi.fn() }));
vi.mock('../services/aiService', () => ({ isLLMConfigured: () => state.llm }));
vi.mock('../ideology', () => ({
  classifyDivisions: vi.fn(async () => ({
    pending: 3,
    read: 1,
    calls: 1,
    statuses: { classified: 1, no_signal: 0, no_context: 0, failed: 0 },
    promptTokens: 1200,
    completionTokens: 300,
    readings: [
      {
        divisionId: 'dail-34-2025-06-25-vote_91',
        date: '2025-06-25',
        subject: 'Amendment put',
        status: 'classified',
        classification: { taMeans: 'Defer the tax.', taLean: { economic: -2 }, nilLean: { economic: 1.5 }, nilWeight: 0.4, confidence: 0.8, salience: 0.6 },
        model: 'stub-model',
        error: null,
      },
    ],
  })),
  syncDivisionEvidence: vi.fn(async () => ({ divisions: 2, rows: 5, tds: 170, parties: 9 })),
  runDivisionAudit: vi.fn(async () => ({
    audit: { divisions: 1, agree: 1, total: 2, byDimension: { economic: { agree: 1, total: 2 } }, worst: [] },
    resample: null,
  })),
  recalculateAll: vi.fn(async () => ({ quizzesRescored: 0, users: 0, tds: 0, parties: 0 })),
  unknownTdCount: () => 0,
}));

const ideology = await import('../ideology');
const { oireachtasVoteUrl, parseArgs, run } = await import('./ideology');

describe('npm run ideology: arguments', () => {
  it('keeps --recalculate, and needs --divisions for everything else', () => {
    expect(parseArgs(['--recalculate'])).toEqual({ mode: 'recalculate' });
    expect(() => parseArgs([])).toThrow(/Usage/);
    expect(() => parseArgs(['--dry-run'])).toThrow(/Usage/);
    expect(() => parseArgs(['--recalculate', '--divisions'])).toThrow(/one of/);
  });

  it('reads the division modes', () => {
    expect(parseArgs(['--divisions'])).toEqual({ mode: 'classify', dryRun: false, reclassify: false, limit: null });
    // A dry run defaults to 20 divisions, so a forgotten --limit cannot spend a whole backfill.
    expect(parseArgs(['--divisions', '--dry-run'])).toEqual({ mode: 'classify', dryRun: true, reclassify: false, limit: 20 });
    expect(parseArgs(['--divisions', '--dry-run', '--limit', '5'])).toEqual({ mode: 'classify', dryRun: true, reclassify: false, limit: 5 });
    expect(parseArgs(['--divisions', '--reclassify', '--limit', '40'])).toEqual({ mode: 'classify', dryRun: false, reclassify: true, limit: 40 });
    expect(parseArgs(['--divisions', '--audit'])).toEqual({ mode: 'audit', resample: 0 });
    expect(parseArgs(['--divisions', '--audit', '--resample', '20'])).toEqual({ mode: 'audit', resample: 20 });
    expect(parseArgs(['--divisions', '--evidence-only'])).toEqual({ mode: 'evidence' });
  });

  it('refuses an unknown flag rather than running a paid classification', () => {
    // The plan's first draft called it --evidence; read as "classify everything" it would spend the backfill.
    expect(() => parseArgs(['--divisions', '--evidence'])).toThrow(/Unknown flag --evidence/);
    expect(() => parseArgs(['--divisions', '--audit', '--evidence-only'])).toThrow(/one of/);
    expect(() => parseArgs(['--divisions', '--audit', '--dry-run'])).toThrow(/only with/);
    expect(() => parseArgs(['--divisions', '--evidence-only', '--limit', '5'])).toThrow(/only with/);
    expect(() => parseArgs(['--divisions', '--resample', '5'])).toThrow(/only with --audit/);
    for (const bad of [[], ['0'], ['-5'], ['1.5'], ['abc']]) {
      expect(() => parseArgs(['--divisions', '--limit', ...bad])).toThrow(/--limit/);
    }
  });
});

describe('npm run ideology: what each mode runs', () => {
  const lines: string[] = [];
  const log = (line: string) => lines.push(line);
  beforeEach(() => {
    vi.clearAllMocks();
    lines.length = 0;
    state.llm = true;
  });

  it('--evidence-only syncs evidence and calls no model, even with no LLM configured', async () => {
    state.llm = false;
    await run(['--divisions', '--evidence-only'], log);
    expect(ideology.syncDivisionEvidence).toHaveBeenCalledTimes(1);
    expect(ideology.classifyDivisions).not.toHaveBeenCalled();
    expect(lines.join('\n')).toContain('5 evidence row(s) from 2 division(s)');
  });

  it('--dry-run reads 20, writes nothing, and prints each reading with its link and the token totals', async () => {
    await run(['--divisions', '--dry-run'], log);
    expect(ideology.classifyDivisions).toHaveBeenCalledWith({ limit: 20, dryRun: true, reclassify: false });
    expect(ideology.syncDivisionEvidence).not.toHaveBeenCalled();
    const out = lines.join('\n');
    expect(out).toContain('dail-34-2025-06-25-vote_91');
    expect(out).toContain('Defer the tax.');
    expect(out).toContain('economic -2');
    expect(out).toContain('https://www.oireachtas.ie/en/debates/vote/dail/34/2025-06-25/91/');
    expect(out).toMatch(/\[dry run, nothing written\].*1200 prompt \+ 300 completion tokens/);
  });

  it('--divisions reads and stores, but does not sync evidence', async () => {
    await run(['--divisions', '--reclassify'], log);
    expect(ideology.classifyDivisions).toHaveBeenCalledWith({ limit: null, dryRun: false, reclassify: true });
    expect(ideology.syncDivisionEvidence).not.toHaveBeenCalled();
  });

  it('refuses to read divisions with no LLM configured', async () => {
    state.llm = false;
    await expect(run(['--divisions'], log)).rejects.toThrow(/No LLM/);
    await expect(run(['--divisions', '--audit', '--resample', '3'], log)).rejects.toThrow(/No LLM/);
    expect(ideology.classifyDivisions).not.toHaveBeenCalled();
    expect(ideology.runDivisionAudit).not.toHaveBeenCalled();
  });

  it('--audit needs no model unless it resamples', async () => {
    state.llm = false;
    await run(['--divisions', '--audit'], log);
    expect(ideology.runDivisionAudit).toHaveBeenCalledWith({ resample: 0 });
    expect(lines.join('\n')).toMatch(/1 of 2.*50%/);
  });

  it('--recalculate still rebuilds every profile', async () => {
    await run(['--recalculate'], log);
    expect(ideology.recalculateAll).toHaveBeenCalledTimes(1);
  });
});

describe('oireachtasVoteUrl', () => {
  it("links a division's page on oireachtas.ie", () => {
    expect(oireachtasVoteUrl('dail-34-2025-06-25-vote_91')).toBe('https://www.oireachtas.ie/en/debates/vote/dail/34/2025-06-25/91/');
    expect(oireachtasVoteUrl('test:1')).toBeNull();
  });
});

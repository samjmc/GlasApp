import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The real scheduler, with node-cron and every job stubbed: the test runs the 04:45 callback
// itself, so it proves what the cron would do, without a database or a model. runJob is
// replaced by one that keeps each job's outcome, as politics.job_runs would.
const jobs = vi.hoisted(() => {
  // The real syncHadFailures lives beside the sync, which imports the pool (it never connects here).
  process.env.DATABASE_URL ??= 'postgres://scheduler-test@127.0.0.1:1/none';
  return [] as Array<{ expression: string; run: () => Promise<void>; options: Record<string, unknown> }>;
});
const recorded = vi.hoisted(() => [] as Array<{ job: string; ok?: boolean; summary?: Record<string, unknown>; error?: string }>);
vi.mock('node-cron', () => ({
  default: { schedule: (expression: string, run: () => Promise<void>, options: Record<string, unknown>) => jobs.push({ expression, run, options }) },
}));
vi.mock('./jobRuns', () => ({
  runJob: vi.fn(async (job: string, run: () => Promise<{ ok: boolean; summary: Record<string, unknown> }>) => {
    try {
      recorded.push({ job, ...(await run()) });
    } catch (error) {
      recorded.push({ job, ok: false, error: (error as Error).message });
    }
  }),
}));
vi.mock('../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../news/tdPipeline', () => ({ runTdPipeline: vi.fn() }));
vi.mock('../news/ingest', () => ({ ingest: vi.fn() }));
const cleanSync = () => ({
  divisions: { ingested: 0 },
  debates: { days: 0, failedDays: [] as string[] },
  committees: { failedDays: [] },
  questions: { failedMonths: [] },
  interests: { failedFiles: [] },
  allowances: { failedFiles: [] },
  failedFeeds: [],
});
vi.mock('../parliament', async () => ({
  runSync: vi.fn(async () => cleanSync()),
  syncHadFailures: (await vi.importActual<typeof import('../parliament/sync')>('../parliament/sync')).syncHadFailures,
  leaveWatch: { runLeaveWatch: vi.fn() },
  extractDebates: vi.fn(async () => ({ debates: 0, done: 0, failed: 0, capped: 0, calls: 0, stopped: null })),
  extractQuestions: vi.fn(async () => ({ debates: 0, done: 0, failed: 0, capped: 0, calls: 0, stopped: null })),
}));
vi.mock('../stances', () => ({ runDivisionStances: vi.fn(async () => ({ classify: null, sync: { rows: 0, evidence: 0 } })) }));

const { initScheduler } = await import('./scheduler');
const { runDivisionStances } = await import('../stances');
const { runSync, extractDebates, extractQuestions } = await import('../parliament');

const FLAG = 'DIVISION_STANCES';
const before = process.env[FLAG];
const setFlag = (value: string | undefined) => {
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
};

describe('the scheduler', () => {
  initScheduler();

  it('runs every job in Dublin time, never overlapping a run of itself', () => {
    expect(jobs.map((j) => j.expression)).toEqual(['30 1-23/2 * * *', '0 */2 * * *', '45 4 * * *', '15 6 * * 1']);
    for (const job of jobs) expect(job.options).toEqual({ timezone: 'Europe/Dublin', noOverlap: true });
  });
});

describe('the 04:45 parliament run', () => {
  const nightly = jobs.find((j) => j.expression === '45 4 * * *')!;

  beforeEach(() => {
    vi.clearAllMocks();
    recorded.length = 0;
  });
  afterAll(() => setFlag(before));

  it('does no division work unless DIVISION_STANCES is exactly "on"', async () => {
    expect(nightly).toBeDefined();
    for (const value of [undefined, '', 'off', 'true', '1', 'ON']) {
      setFlag(value);
      await nightly.run();
    }
    expect(runSync).toHaveBeenCalledTimes(6);
    expect(runDivisionStances).not.toHaveBeenCalled();
    expect(recorded.map((r) => r.job)).toEqual(Array(6).fill('parliament-sync'));
  });

  it('records a sync with a failed day as not ok, though it did not throw', async () => {
    setFlag(undefined);
    vi.mocked(runSync).mockResolvedValueOnce({ ...cleanSync(), debates: { days: 3, failedDays: ['2026-10-01'] } } as never);
    await nightly.run();
    expect(recorded).toEqual([expect.objectContaining({ job: 'parliament-sync', ok: false, summary: expect.objectContaining({ failedDays: ['2026-10-01'] }) })]);
  });

  it('with DIVISION_STANCES=on, runs the nightly division job after the sync, even when the sync failed', async () => {
    setFlag('on');
    await nightly.run();
    expect(runDivisionStances).toHaveBeenCalledWith({ mode: 'nightly' });
    expect(vi.mocked(runSync).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runDivisionStances).mock.invocationCallOrder[0]);

    recorded.length = 0;
    vi.mocked(runSync).mockRejectedValueOnce(new Error('Oireachtas down'));
    vi.mocked(runDivisionStances).mockRejectedValueOnce(new Error('already running'));
    await expect(nightly.run()).resolves.toBeUndefined(); // each job is recorded, never thrown
    expect(runDivisionStances).toHaveBeenCalledTimes(2);
    expect(recorded).toEqual([
      { job: 'parliament-sync', ok: false, error: 'Oireachtas down' },
      { job: 'division-stances', ok: false, error: 'already running' },
    ]);
  });

  it('reads new debates for items only when DEBATE_ITEMS is exactly "on", after the sync, a night\'s worth at most', async () => {
    const before = process.env.DEBATE_ITEMS;
    try {
      for (const value of [undefined, 'off', 'ON']) {
        if (value === undefined) delete process.env.DEBATE_ITEMS;
        else process.env.DEBATE_ITEMS = value;
        await nightly.run();
      }
      expect(extractDebates).not.toHaveBeenCalled();

      process.env.DEBATE_ITEMS = 'on';
      await nightly.run();
      expect(extractDebates).toHaveBeenCalledWith({ limit: 30 });
      expect(vi.mocked(runSync).mock.invocationCallOrder.at(-1)!).toBeLessThan(vi.mocked(extractDebates).mock.invocationCallOrder[0]);

      // A run stopped by an empty account is recorded as not ok.
      recorded.length = 0;
      vi.mocked(extractDebates).mockResolvedValueOnce({ debates: 30, done: 4, failed: 0, capped: 0, calls: 9, stopped: 'no credit' } as never);
      await nightly.run();
      expect(recorded.find((r) => r.job === 'debate-items')).toMatchObject({ ok: false, summary: { done: 4, stopped: 'no credit' } });

      vi.mocked(extractDebates).mockRejectedValueOnce(new Error('402 Insufficient Balance'));
      await expect(nightly.run()).resolves.toBeUndefined();
    } finally {
      if (before === undefined) delete process.env.DEBATE_ITEMS;
      else process.env.DEBATE_ITEMS = before;
    }
  });

  it('reads new question exchanges only when QUESTION_ITEMS is exactly "on", after the sync', async () => {
    const before = process.env.QUESTION_ITEMS;
    try {
      for (const value of [undefined, 'off', 'ON']) {
        if (value === undefined) delete process.env.QUESTION_ITEMS;
        else process.env.QUESTION_ITEMS = value;
        await nightly.run();
      }
      expect(extractQuestions).not.toHaveBeenCalled();

      process.env.QUESTION_ITEMS = 'on';
      await nightly.run();
      expect(extractQuestions).toHaveBeenCalledWith({ limit: 100 });
      expect(vi.mocked(runSync).mock.invocationCallOrder.at(-1)!).toBeLessThan(vi.mocked(extractQuestions).mock.invocationCallOrder[0]);

      vi.mocked(extractQuestions).mockRejectedValueOnce(new Error('402 Insufficient Balance'));
      await expect(nightly.run()).resolves.toBeUndefined();
    } finally {
      if (before === undefined) delete process.env.QUESTION_ITEMS;
      else process.env.QUESTION_ITEMS = before;
    }
  });
});

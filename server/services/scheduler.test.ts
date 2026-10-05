import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The real scheduler, with node-cron and every job stubbed: the test runs the 04:45 callback
// itself, so it proves what the cron would do, without a database or a model.
const jobs = vi.hoisted(() => [] as Array<{ expression: string; run: () => Promise<void> }>);
vi.mock('node-cron', () => ({
  default: { schedule: (expression: string, run: () => Promise<void>) => jobs.push({ expression, run }) },
}));
vi.mock('../news/tdPipeline', () => ({ runTdPipeline: vi.fn() }));
vi.mock('../news/ingest', () => ({ ingest: vi.fn() }));
vi.mock('../parliament', () => ({
  runSync: vi.fn(async () => ({ divisions: { ingested: 0 }, debates: { days: 0, failedDays: [] }, failedFeeds: [] })),
  leaveWatch: { runLeaveWatch: vi.fn() },
  extractDebates: vi.fn(async () => ({ done: 0, failed: 0, stopped: null })),
}));
vi.mock('../stances', () => ({ runDivisionStances: vi.fn(async () => ({})) }));

const { initScheduler } = await import('./scheduler');
const { runDivisionStances } = await import('../stances');
const { runSync, extractDebates } = await import('../parliament');

const FLAG = 'DIVISION_STANCES';
const before = process.env[FLAG];
const setFlag = (value: string | undefined) => {
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
};

describe('the 04:45 parliament run', () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  initScheduler();
  const nightly = jobs.find((j) => j.expression === '45 4 * * *')!;

  beforeEach(() => vi.clearAllMocks());
  afterAll(() => setFlag(before));

  it('does no division work unless DIVISION_STANCES is exactly "on"', async () => {
    expect(nightly).toBeDefined();
    for (const value of [undefined, '', 'off', 'true', '1', 'ON']) {
      setFlag(value);
      await nightly.run();
    }
    expect(runSync).toHaveBeenCalledTimes(6);
    expect(runDivisionStances).not.toHaveBeenCalled();
  });

  it('with DIVISION_STANCES=on, runs the nightly division job after the sync, even when the sync failed', async () => {
    setFlag('on');
    await nightly.run();
    expect(runDivisionStances).toHaveBeenCalledWith({ mode: 'nightly' });
    expect(vi.mocked(runSync).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runDivisionStances).mock.invocationCallOrder[0]);

    vi.mocked(runSync).mockRejectedValueOnce(new Error('Oireachtas down'));
    vi.mocked(runDivisionStances).mockRejectedValueOnce(new Error('already running'));
    await expect(nightly.run()).resolves.toBeUndefined(); // its own try/catch: a failure is logged, not thrown
    expect(runDivisionStances).toHaveBeenCalledTimes(2);
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

      vi.mocked(extractDebates).mockRejectedValueOnce(new Error('402 Insufficient Balance'));
      await expect(nightly.run()).resolves.toBeUndefined();
    } finally {
      if (before === undefined) delete process.env.DEBATE_ITEMS;
      else process.env.DEBATE_ITEMS = before;
    }
  });
});

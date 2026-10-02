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
}));
vi.mock('../ideology', () => ({ runDivisionIdeology: vi.fn(async () => ({})) }));

const { initScheduler } = await import('./scheduler');
const { runDivisionIdeology } = await import('../ideology');
const { runSync } = await import('../parliament');

const FLAG = 'DIVISION_IDEOLOGY';
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

  it('does no division work unless DIVISION_IDEOLOGY is exactly "on"', async () => {
    expect(nightly).toBeDefined();
    for (const value of [undefined, '', 'off', 'true', '1', 'ON']) {
      setFlag(value);
      await nightly.run();
    }
    expect(runSync).toHaveBeenCalledTimes(6);
    expect(runDivisionIdeology).not.toHaveBeenCalled();
  });

  it('with DIVISION_IDEOLOGY=on, runs the nightly division job after the sync, even when the sync failed', async () => {
    setFlag('on');
    await nightly.run();
    expect(runDivisionIdeology).toHaveBeenCalledWith({ mode: 'nightly' });
    expect(vi.mocked(runSync).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runDivisionIdeology).mock.invocationCallOrder[0]);

    vi.mocked(runSync).mockRejectedValueOnce(new Error('Oireachtas down'));
    vi.mocked(runDivisionIdeology).mockRejectedValueOnce(new Error('already running'));
    await expect(nightly.run()).resolves.toBeUndefined(); // its own try/catch: a failure is logged, not thrown
    expect(runDivisionIdeology).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildCompletion,
  computeShifts,
  computeStreak,
  directionOf,
  leanOf,
  rankAxes,
  sessionDateFor,
  summariseRegion,
} from './summary';

const zero = { economic: 0, social: 0, cultural: 0, authority: 0, environmental: 0, welfare: 0, globalism: 0, technocratic: 0 };

describe('sessionDateFor', () => {
  it('uses Irish local time, not UTC', () => {
    // 23:30 UTC on 21 Sept is 00:30 IST on 22 Sept.
    expect(sessionDateFor(new Date('2026-09-21T23:30:00Z'))).toBe('2026-09-22');
    // In winter Ireland is on UTC, so the date does not roll over.
    expect(sessionDateFor(new Date('2026-12-21T23:30:00Z'))).toBe('2026-12-21');
  });
});

describe('computeStreak', () => {
  it('counts today even with no history', () => {
    expect(computeStreak([], '2026-09-22')).toBe(1);
  });

  it('counts consecutive days ending today, in any input order', () => {
    expect(computeStreak(['2026-09-20', '2026-09-21', '2026-09-19'], '2026-09-22')).toBe(4);
  });

  it('stops at the first missed day', () => {
    expect(computeStreak(['2026-09-21', '2026-09-19', '2026-09-18'], '2026-09-22')).toBe(2);
  });

  it('crosses a month boundary', () => {
    expect(computeStreak(['2026-09-30'], '2026-10-01')).toBe(2);
  });

  // The old service computed the streak BEFORE marking today complete, so its loop
  // always stopped at once and every user's streak was 1. This is that scenario.
  it('does not reset to 1 when yesterday was completed', () => {
    expect(computeStreak(['2026-09-21'], '2026-09-22')).toBe(2);
  });
});

describe('computeShifts', () => {
  it('is empty without both profiles', () => {
    expect(computeShifts(null, zero)).toEqual([]);
    expect(computeShifts(zero, null)).toEqual([]);
  });

  it('reports each moved axis, largest first, and skips unmoved ones', () => {
    const shifts = computeShifts({ ...zero, economic: 1, welfare: 2 }, { ...zero, economic: 1.5, welfare: 1 });
    expect(shifts.map((s) => [s.ideologyDimension, s.delta, s.direction])).toEqual([
      ['welfare', -1, 'left'],
      ['economic', 0.5, 'right'],
    ]);
    expect(shifts[0]).toMatchObject({ before: 2, after: 1, deltaPercent: -10 });
  });
});

describe('leanOf', () => {
  it('is the weight-averaged position of the chosen options', () => {
    const lean = leanOf([
      { vector: { ...zero, economic: 2 }, weight: 3 },
      { vector: { ...zero, economic: -2, social: 1 }, weight: 1 },
    ])!;
    expect(lean.economic).toBe(1);
    expect(lean.social).toBe(0.25);
  });

  it('is null with no votes', () => {
    expect(leanOf([])).toBeNull();
  });
});

describe('rankAxes and directionOf', () => {
  it('orders by magnitude and drops zero axes', () => {
    expect(rankAxes({ economic: -3, social: 1, welfare: 0 })).toEqual(['economic', 'social']);
  });
  it('treats a tiny move as neutral', () => {
    expect(directionOf(0.00001)).toBe('neutral');
    expect(directionOf(-0.2)).toBe('left');
  });
});

describe('summariseRegion', () => {
  const region = (overrides = {}) => ({
    kind: 'county' as const,
    name: 'Cork',
    finishedToday: 3,
    today: { economic: 4, social: -1 },
    yesterday: { social: 5, economic: 1 },
    ...overrides,
  });

  it('asks for a location when none is set', () => {
    expect(summariseRegion({ ...region(), kind: null }, null).regionSummary).toMatch(/Add your county/);
  });

  it('reports the rank change of the focus axis', () => {
    const summary = summariseRegion(region(), 'economic');
    expect(summary).toMatchObject({ regionDimension: 'economic', regionPreviousRank: 2, regionCurrentRank: 1 });
    expect(summary.regionSummary).toBe('Cork moved Economic from #2 to #1 today.');
  });

  it('falls back to the top axis when the focus axis did not move locally', () => {
    expect(summariseRegion(region({ yesterday: null }), 'cultural')).toMatchObject({
      regionDimension: 'economic',
      regionCurrentRank: 1,
      regionPreviousRank: undefined,
    });
  });
});

describe('buildCompletion', () => {
  const region = { regionSummary: 'r' };

  it('leads with the largest real profile shift when there is one', () => {
    const completion = buildCompletion({
      shifts: computeShifts({ ...zero, welfare: 1 }, { ...zero, welfare: 0.4 }),
      lean: { ...zero, economic: 2 },
      streakCount: 2,
      voteCount: 3,
      itemCount: 3,
      region,
    });
    expect(completion.ideologyAxis).toBe('Welfare Expansive - Limited');
    expect(completion.ideologyDirection).toBe('left');
    expect(completion.ideologyDelta).toBeCloseTo(6);
    expect(completion.dimensionShifts).toHaveLength(1);
  });

  it('describes the lean, without inventing a shift, when no profile exists', () => {
    const completion = buildCompletion({
      shifts: [],
      lean: { ...zero, globalism: 1.2 },
      streakCount: 1,
      voteCount: 3,
      itemCount: 3,
      region,
    });
    expect(completion.dimensionShifts).toEqual([]);
    expect(completion.ideologyDelta).toBe(0);
    expect(completion.ideologySummary).toBe('Your answers today leaned right on Globalism International - National.');
    expect(completion.detailStats.map((s) => s.label)).toEqual(['Issues completed', 'Streak']);
  });
});

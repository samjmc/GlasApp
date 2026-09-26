import { describe, expect, it } from 'vitest';
import {
  MIN_COMPONENTS_FOR_RANK,
  normalizePercent,
  overallFromPillars,
  parliamentaryScore,
  PILLAR_WEIGHTS,
  scoreLabel,
} from './weights';

describe('PILLAR_WEIGHTS', () => {
  // News carries no weight: the score is built only from checkable Oireachtas facts.
  it('has exactly the parliamentary and debate pillars, at 0.55 / 0.45', () => {
    expect(Object.keys(PILLAR_WEIGHTS).sort()).toEqual(['debate', 'parliamentary']);
    expect(PILLAR_WEIGHTS).toEqual({ parliamentary: 0.55, debate: 0.45 });
  });

  it('ranks a TD only with at least two measurable components', () => {
    expect(MIN_COMPONENTS_FOR_RANK).toBe(2);
  });
});

describe('overallFromPillars', () => {
  it('uses the declared weights when every pillar is present', () => {
    const expected = Math.round(60 * PILLAR_WEIGHTS.parliamentary + 40 * PILLAR_WEIGHTS.debate);
    expect(overallFromPillars({ parliamentary: 60, debate: 40 })).toBe(expected);
  });

  it('renormalises over the pillars that have data', () => {
    expect(overallFromPillars({ parliamentary: 70, debate: null })).toBe(70);
    expect(overallFromPillars({ debate: 30 })).toBe(30);
  });

  it('is NULL when nothing has data', () => {
    expect(overallFromPillars({})).toBeNull();
    expect(overallFromPillars({ parliamentary: null, debate: undefined })).toBeNull();
  });
});

describe('parliamentaryScore', () => {
  it('is 50% questions, 30% votes, 20% committees, each capped at its benchmark', () => {
    expect(parliamentaryScore(200, 95, 85)).toBe(100);
    expect(parliamentaryScore(900, 99, 100)).toBe(100);
    expect(parliamentaryScore(100, 47.5, 42.5)).toBe(50);
    expect(parliamentaryScore(0, 0, 0)).toBe(0);
    expect(parliamentaryScore(200, 0, 0)).toBe(50);
    expect(parliamentaryScore(0, 95, 0)).toBe(30);
    expect(parliamentaryScore(0, 0, 85)).toBe(20);
  });

  it('with no committee measure, scores questions and votes 62.5 / 37.5', () => {
    expect(parliamentaryScore(200, 0, null)).toBe(63);
    expect(parliamentaryScore(0, 95, null)).toBe(38);
    expect(parliamentaryScore(0, 95)).toBe(38);
    expect(parliamentaryScore(200, 95)).toBe(100);
  });

  it('lets a single present input carry the pillar, and is NULL with none', () => {
    expect(parliamentaryScore(100, null, null)).toBe(50);
    expect(parliamentaryScore(null, 95, null)).toBe(100);
    expect(parliamentaryScore(null, null, 42.5)).toBe(50);
    expect(parliamentaryScore(null, null, null)).toBeNull();
  });
});

describe('normalizePercent', () => {
  it('accepts fractions or percentages and keeps NULL as NULL', () => {
    expect(normalizePercent(0.42)).toBe(42);
    expect(normalizePercent(1)).toBe(100);
    expect(normalizePercent(73)).toBe(73);
    expect(normalizePercent(140)).toBe(100);
    expect(normalizePercent(null)).toBeNull();
  });
});

describe('scoreLabel', () => {
  it('bands at 90/75/60/40', () => {
    expect(scoreLabel(90)).toBe('Excellent');
    expect(scoreLabel(89)).toBe('Good');
    expect(scoreLabel(75)).toBe('Good');
    expect(scoreLabel(60)).toBe('Average');
    expect(scoreLabel(40)).toBe('Below Average');
    expect(scoreLabel(39)).toBe('Poor');
  });
});

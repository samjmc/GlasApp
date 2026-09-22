import { describe, expect, it } from 'vitest';
import {
  eloToPercent,
  normalizePercent,
  overallFromPillars,
  parliamentaryScore,
  PILLAR_WEIGHTS,
  scoreLabel,
} from './weights';

describe('eloToPercent', () => {
  it('maps 1000..2000 onto 0..100 and clamps outside', () => {
    expect(eloToPercent(1000)).toBe(0);
    expect(eloToPercent(1500)).toBe(50);
    expect(eloToPercent(2000)).toBe(100);
    expect(eloToPercent(1234)).toBe(23);
    expect(eloToPercent(900)).toBe(0);
    expect(eloToPercent(2500)).toBe(100);
  });

  it('treats missing as baseline', () => {
    expect(eloToPercent(null)).toBe(50);
    expect(eloToPercent(undefined)).toBe(50);
    expect(eloToPercent(Number.NaN)).toBe(50);
  });
});

describe('overallFromPillars', () => {
  it('uses the declared weights when every pillar is present', () => {
    const expected = Math.round(80 * PILLAR_WEIGHTS.news + 60 * PILLAR_WEIGHTS.parliamentary + 40 * PILLAR_WEIGHTS.debate);
    expect(overallFromPillars({ news: 80, parliamentary: 60, debate: 40 })).toBe(expected);
  });

  it('renormalises over the pillars that have data', () => {
    // news .45 and parliamentary .30 → 60/40 split
    expect(overallFromPillars({ news: 100, parliamentary: 0, debate: null })).toBe(60);
    expect(overallFromPillars({ news: 70 })).toBe(70);
  });

  it('is NULL when nothing has data', () => {
    expect(overallFromPillars({})).toBeNull();
    expect(overallFromPillars({ news: null, parliamentary: undefined })).toBeNull();
  });
});

describe('parliamentaryScore', () => {
  it('is 60% questions, 40% attendance, each capped at its benchmark', () => {
    expect(parliamentaryScore(200, 95)).toBe(100);
    expect(parliamentaryScore(900, 99)).toBe(100);
    expect(parliamentaryScore(100, 47.5)).toBe(50);
    expect(parliamentaryScore(0, 0)).toBe(0);
  });

  it('lets a single present input carry the pillar, and is NULL with none', () => {
    expect(parliamentaryScore(100, null)).toBe(50);
    expect(parliamentaryScore(null, 95)).toBe(100);
    expect(parliamentaryScore(null, null)).toBeNull();
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

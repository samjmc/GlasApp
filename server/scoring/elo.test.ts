import { describe, expect, it } from 'vitest';
import { applyArticle, articleAgeDays, baselineRatings, eloDelta, K_FACTOR } from './elo';

describe('eloDelta', () => {
  it('scales linearly with impact and credibility', () => {
    expect(eloDelta(10, 1)).toBe(K_FACTOR);
    expect(eloDelta(-10, 1)).toBe(-K_FACTOR);
    expect(eloDelta(5, 1)).toBe(16);
    expect(eloDelta(10, 0.5)).toBe(16);
    expect(eloDelta(0, 1)).toBe(0);
  });

  it('clamps impact to ±10 and credibility to 0..1', () => {
    expect(eloDelta(50, 1)).toBe(K_FACTOR);
    expect(eloDelta(10, 3)).toBe(K_FACTOR);
    expect(eloDelta(10, -1)).toBe(0);
  });

  it('applies no decay up to 90 days, then halves every 30', () => {
    expect(eloDelta(10, 1, 90)).toBe(32);
    expect(eloDelta(10, 1, 120)).toBe(16);
    expect(eloDelta(10, 1, 150)).toBe(8);
    expect(eloDelta(10, 1, 360)).toBe(0);
  });
});

describe('articleAgeDays', () => {
  it('counts whole days and never goes negative', () => {
    const now = new Date('2026-09-21T12:00:00Z');
    expect(articleAgeDays(new Date('2026-09-21T01:00:00Z'), now)).toBe(0);
    expect(articleAgeDays(new Date('2026-09-11T12:00:00Z'), now)).toBe(10);
    expect(articleAgeDays(new Date('2026-09-25T00:00:00Z'), now)).toBe(0);
  });
});

describe('applyArticle', () => {
  it('moves overall and only the dimensions the panel scored', () => {
    const { updated, changes } = applyArticle(
      baselineRatings(),
      { overall: 10, transparency: -5, integrity: null, consistency: 0 },
      1,
    );
    expect(updated.overall).toBe(1532);
    expect(updated.transparency).toBe(1484);
    expect(updated.integrity).toBe(1500);
    expect(updated.consistency).toBe(1500);
    expect(updated.effectiveness).toBe(1500);
    expect(changes.map((c) => c.key)).toEqual(['overall', 'transparency']);
    expect(changes[1]).toMatchObject({ oldElo: 1500, newElo: 1484, delta: -16, impact: -5 });
  });

  it('produces no change records when everything rounds to zero', () => {
    const { updated, changes } = applyArticle(baselineRatings(), { overall: 1 }, 0.1);
    expect(changes).toEqual([]);
    expect(updated).toEqual(baselineRatings());
  });

  it('does not mutate the input ratings', () => {
    const current = baselineRatings();
    applyArticle(current, { overall: 10 }, 1);
    expect(current.overall).toBe(1500);
  });
});

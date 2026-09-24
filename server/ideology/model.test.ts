import { describe, expect, it } from 'vitest';
import { emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';
import { computeProfile, decayFactor, meanProfile, type Observation } from './model';

const now = new Date('2026-09-24T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const noDecay = { now, halfLifeDays: null };
const at = (v: Partial<IdeologyVector>): IdeologyVector => ({ ...emptyIdeologyVector(), ...v });

describe('computeProfile', () => {
  it('is the weighted mean of the observations', () => {
    const obs: Observation[] = [
      { vector: { economic: 6 }, weight: 1, observedAt: now },
      { vector: { economic: 0 }, weight: 2, observedAt: now },
    ];
    const p = computeProfile(null, obs, noDecay);
    expect(p.vector.economic).toBe(2);
    expect(p.totalWeight).toBe(3);
    expect(p.evidenceCount).toBe(2);
  });

  it('does not depend on the order evidence arrived in', () => {
    const obs: Observation[] = [
      { vector: { economic: 8, welfare: -4 }, weight: 1.5, observedAt: daysAgo(10) },
      { vector: { economic: -2 }, weight: 0.7, observedAt: daysAgo(300) },
      { vector: { welfare: 6, globalism: 3 }, weight: 2, observedAt: daysAgo(40) },
    ];
    const opts = { now, halfLifeDays: 180 };
    expect(computeProfile(null, obs, opts)).toEqual(computeProfile(null, [...obs].reverse(), opts));
  });

  it('never pulls a dimension toward 0 when the evidence is silent on it', () => {
    const p = computeProfile(
      null,
      [
        { vector: { economic: 8 }, weight: 1, observedAt: now },
        { vector: { social: -4 }, weight: 5, observedAt: now },
      ],
      noDecay,
    );
    expect(p.vector.economic).toBe(8);
    expect(p.vector.social).toBe(-4);
    expect(p.vector.welfare).toBe(0);
  });

  it('starts from the prior and moves toward the evidence', () => {
    const prior = { vector: at({ economic: -6 }), weight: 3 };
    expect(computeProfile(prior, [], noDecay).vector.economic).toBe(-6);
    const moved = computeProfile(prior, [{ vector: { economic: 6 }, weight: 3, observedAt: now }], noDecay);
    expect(moved.vector.economic).toBe(0);
    expect(moved.totalWeight).toBe(3); // the prior is not evidence
  });

  it('lets old evidence count for less', () => {
    const opts = { now, halfLifeDays: 180 };
    const p = computeProfile(
      null,
      [
        { vector: { economic: 10 }, weight: 1, observedAt: daysAgo(180) },
        { vector: { economic: -10 }, weight: 1, observedAt: now },
      ],
      opts,
    );
    // weights 0.5 and 1 → (5 − 10) / 1.5
    expect(p.vector.economic).toBeCloseTo(-3.33, 2);
  });

  it('ignores non-positive weights and non-finite values, and clamps to ±10', () => {
    const p = computeProfile(
      null,
      [
        { vector: { economic: 5 }, weight: 0, observedAt: now },
        { vector: { economic: Number.NaN, social: 50 }, weight: 1, observedAt: now },
      ],
      noDecay,
    );
    expect(p.vector.economic).toBe(0);
    expect(p.vector.social).toBe(10);
    expect(p.evidenceCount).toBe(1);
  });
});

describe('decayFactor', () => {
  it('halves every half-life and never exceeds 1 for future dates', () => {
    expect(decayFactor(daysAgo(0), { now, halfLifeDays: 180 })).toBe(1);
    expect(decayFactor(daysAgo(360), { now, halfLifeDays: 180 })).toBeCloseTo(0.25, 6);
    expect(decayFactor(daysAgo(-5), { now, halfLifeDays: 180 })).toBe(1);
    expect(decayFactor(daysAgo(9999), noDecay)).toBe(1);
  });
});

describe('meanProfile', () => {
  it('weights members and returns null when there are none', () => {
    expect(meanProfile([])).toBeNull();
    const v = meanProfile([
      { vector: at({ economic: 4 }), weight: 1 },
      { vector: at({ economic: -2 }), weight: 2 },
    ]);
    expect(v?.economic).toBe(0);
  });
});

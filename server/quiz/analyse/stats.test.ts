import { describe, expect, it } from 'vitest';
import { disattenuate, fisherInterval, pearson, poolCorrelations, standardisedAlpha } from './stats';

describe('pearson', () => {
  it('is the product-moment correlation, and null for n < 3 or zero variance', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 5, 9])).toBeCloseTo(0.9648, 4);
    expect(pearson([1, 2], [2, 4])).toBeNull();
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNull();
    // A repeated non-integer value: its mean is not exact, and its variance must still read as 0.
    expect(pearson([1.67, 1.67, 1.67], [1, 2, 3])).toBeNull();
  });
});

describe('fisherInterval', () => {
  it('is tanh(atanh(r) ± 1.96/√(n−3))', () => {
    const [lo, hi] = fisherInterval(0.2, 10);
    expect(lo).toBeCloseTo(-0.4915, 4);
    expect(hi).toBeCloseTo(0.7368, 4);
  });
});

describe('poolCorrelations', () => {
  it('pools on Fisher z with weights n − 3', () => {
    const pooled = poolCorrelations([{ r: 0.5, n: 103 }, { r: 0, n: 13 }]);
    expect(pooled.r).toBeCloseTo(0.4616, 4);
    expect(pooled.n).toBe(116);
    // SE 1/√Σ(n−3) = 1/√110 on the z scale.
    expect(pooled.lo).toBeCloseTo(Math.tanh(Math.atanh(pooled.r) - 1.96 / Math.sqrt(110)), 10);
    expect(pooled.hi).toBeCloseTo(Math.tanh(Math.atanh(pooled.r) + 1.96 / Math.sqrt(110)), 10);
  });
});

describe('standardisedAlpha and disattenuate', () => {
  it('alpha is k·r̄ / (1 + (k−1)·r̄); disattenuation divides by √(αa·αb)', () => {
    expect(standardisedAlpha(1 / 3, 3)).toBeCloseTo(0.6, 4);
    expect(disattenuate(0.5, 0.5, 0.5)).toBeCloseTo(1, 10);
    expect(disattenuate(0.5, 0, 0.5)).toBeNull();
    expect(disattenuate(0.5, 0.5, -0.2)).toBeNull();
  });
});

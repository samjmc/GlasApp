/**
 * The maths of the item analysis. Pure; no imports.
 *
 * Correlations are pooled on Fisher's z = atanh(r), whose standard error is 1/√(n−3).
 */

/** A sum of squares at or below this is zero variance: a repeated value like 1.67 has an inexact mean. */
const ZERO_VARIANCE = 1e-12;

const Z95 = 1.96;

/** Pearson's r; null when n < 3 or either variance is 0. */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx <= ZERO_VARIANCE || syy <= ZERO_VARIANCE) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** The 95% interval of r from n pairs: tanh(atanh(r) ± 1.96/√(n−3)). */
export function fisherInterval(r: number, n: number): [number, number] {
  const z = Math.atanh(r);
  const half = Z95 / Math.sqrt(n - 3);
  return [Math.tanh(z - half), Math.tanh(z + half)];
}

export interface Pooled {
  r: number;
  lo: number;
  hi: number;
  /** Σ n over the pooled correlations. */
  n: number;
}

/** Fixed-effect pooling on Fisher z: weights n − 3, SE 1/√Σ(n−3). */
export function poolCorrelations(pairs: ReadonlyArray<{ r: number; n: number }>): Pooled {
  let weight = 0;
  let sum = 0;
  let n = 0;
  for (const p of pairs) {
    weight += p.n - 3;
    sum += (p.n - 3) * Math.atanh(p.r);
    n += p.n;
  }
  const z = sum / weight;
  const half = Z95 / Math.sqrt(weight);
  return { r: Math.tanh(z), lo: Math.tanh(z - half), hi: Math.tanh(z + half), n };
}

/** Standardised alpha of k items whose mean inter-item correlation is rBar. */
export function standardisedAlpha(rBar: number, k: number): number {
  return (k * rBar) / (1 + (k - 1) * rBar);
}

/** r corrected for the unreliability of both scores; null unless both alphas are > 0. */
export function disattenuate(r: number, alphaA: number, alphaB: number): number | null {
  if (!(alphaA > 0 && alphaB > 0)) return null;
  return r / Math.sqrt(alphaA * alphaB);
}

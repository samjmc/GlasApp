/**
 * The ideology model. Pure: no I/O, no clock.
 *
 * A profile is a per-dimension weighted mean of positions: a prior (a party baseline, or
 * nothing) plus every observation that says something about that dimension. Because it is a
 * mean and not a running nudge, it does not depend on the order evidence arrived in, and any
 * profile can be rebuilt from its evidence at any time.
 *
 * An observation that is silent on a dimension (undefined there) does not pull that
 * dimension toward 0; it simply does not take part.
 */
import {
  IDEOLOGY_DIMENSIONS,
  clampIdeologyValue,
  emptyIdeologyVector,
  type IdeologyDimension,
  type IdeologyVector,
} from '@shared/ideology';

export type PartialVector = Partial<Record<IdeologyDimension, number>>;

export interface Observation {
  vector: PartialVector;
  /** > 0. */
  weight: number;
  /** Optional per-dimension multiplier on `weight`, 0..1 (a quiz that asked part of a dimension). Missing = 1. */
  dimensionWeight?: PartialVector;
  observedAt: Date;
}

export interface Prior {
  vector: IdeologyVector;
  weight: number;
}

export interface ModelOptions {
  now: Date;
  /** Evidence loses half its weight every this many days. null = no decay. */
  halfLifeDays: number | null;
}

export interface Profile {
  vector: IdeologyVector;
  /** Per dimension, the decayed evidence weight behind it (the prior not included). 0 = unknown. */
  support: IdeologyVector;
  /** Sum of the decayed observation weights (the prior not included). */
  totalWeight: number;
  evidenceCount: number;
}

const DAY_MS = 86_400_000;

export function decayFactor(observedAt: Date, { now, halfLifeDays }: ModelOptions): number {
  if (halfLifeDays === null) return 1;
  const ageDays = Math.max(0, (now.getTime() - observedAt.getTime()) / DAY_MS);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function computeProfile(prior: Prior | null, observations: Observation[], options: ModelOptions): Profile {
  const sums = emptyIdeologyVector();
  const weights = emptyIdeologyVector();
  if (prior) {
    for (const d of IDEOLOGY_DIMENSIONS) {
      sums[d] += prior.weight * prior.vector[d];
      weights[d] += prior.weight;
    }
  }

  const support = emptyIdeologyVector();
  let totalWeight = 0;
  let evidenceCount = 0;
  for (const obs of observations) {
    if (!(obs.weight > 0)) continue;
    const w = obs.weight * decayFactor(obs.observedAt, options);
    let used = false;
    for (const d of IDEOLOGY_DIMENSIONS) {
      const value = obs.vector[d];
      if (value === undefined || !Number.isFinite(value)) continue;
      const share = obs.dimensionWeight?.[d] ?? 1;
      if (!(share > 0)) continue;
      const wd = w * Math.min(1, share);
      sums[d] += wd * clampIdeologyValue(value);
      weights[d] += wd;
      support[d] += wd;
      used = true;
    }
    if (used) {
      totalWeight += w;
      evidenceCount++;
    }
  }

  const vector = emptyIdeologyVector();
  for (const d of IDEOLOGY_DIMENSIONS) {
    vector[d] = weights[d] > 0 ? round(clampIdeologyValue(sums[d] / weights[d])) : 0;
    support[d] = round(support[d]);
  }
  return { vector, support, totalWeight: round(totalWeight), evidenceCount };
}

/** Weighted mean of several full positions, e.g. a party from its TDs. */
export function meanProfile(members: Array<{ vector: IdeologyVector; weight: number }>): IdeologyVector | null {
  const usable = members.filter((m) => m.weight > 0);
  if (usable.length === 0) return null;
  const total = usable.reduce((s, m) => s + m.weight, 0);
  const vector = emptyIdeologyVector();
  for (const d of IDEOLOGY_DIMENSIONS) {
    vector[d] = round(usable.reduce((s, m) => s + m.weight * m.vector[d], 0) / total);
  }
  return vector;
}

const round = (x: number) => Math.round(x * 100) / 100;

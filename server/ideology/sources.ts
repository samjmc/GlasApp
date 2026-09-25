/**
 * How each kind of evidence becomes an observation on the −10..+10 scale. The one place
 * source scales and weights live.
 *
 * Every model prompt that produces these numbers already uses the shared sign rule
 * (+ = right-coded pole), so no source is negated. Each raw value is the lean of ONE stance
 * (an article, a speech, a chosen vote option), read as that stance's position: a TD whose
 * stances keep leaning +0.25 on the ±0.5 scale ends up near +5.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '@shared/ideology';
import type { PartialVector } from './model';

export const SOURCES = {
  /** The scoring panel's Ideology Analyst, per (article, TD). ±0.5, 0 = no signal. */
  article: { max: 0.5 },
  /** Debate speech analysis. ±0.5, 0 = no signal. */
  debate: { max: 0.5 },
  /** A chosen policy-vote option (server/voting). ±2, 0 = says nothing about that axis. */
  vote: { max: 2 },
} as const;

export type SourceKind = keyof typeof SOURCES;

/** Below this share of a source's max, a value is noise, not a stance. */
export const SIGNAL_FLOOR = 0.1;

/** A completed quiz counts as much as ten full-strength votes. */
export const QUIZ_WEIGHT = 10;
/** A TD's party baseline counts as three pieces of full-strength evidence. */
export const PARTY_PRIOR_WEIGHT = 3;
/** TD evidence halves in weight every six months. User evidence does not decay: a user moves by voting or retaking the quiz. */
export const TD_HALF_LIFE_DAYS = 180;

/** Raw source values → an observation vector. Missing, null, non-finite and sub-floor values are left out. */
export function toObservationVector(
  source: SourceKind,
  raw: Partial<Record<IdeologyDimension, number | null | undefined>>,
): PartialVector {
  const { max } = SOURCES[source];
  const scale = 10 / max;
  const out: PartialVector = {};
  for (const d of IDEOLOGY_DIMENSIONS) {
    const value = raw[d];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const bounded = Math.max(-max, Math.min(max, value));
    if (Math.abs(bounded) < SIGNAL_FLOOR * max) continue;
    out[d] = bounded * scale;
  }
  return out;
}

export function hasSignal(vector: PartialVector): boolean {
  return Object.keys(vector).length > 0;
}

/**
 * ELO maths. Pure functions, no I/O.
 *
 * A TD has one overall rating and one per dimension. Each scored article moves them by
 * `impact/10 × K × credibility`, decayed once the article is older than 90 days.
 */

export const K_FACTOR = 32;
export const BASELINE_ELO = 1500;
/** Articles older than this start losing weight. */
export const DECAY_START_DAYS = 90;
/** Past the start, weight halves every this many days. */
export const DECAY_HALF_LIFE_DAYS = 30;

export const DIMENSIONS = ['transparency', 'effectiveness', 'integrity', 'consistency'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type EloKey = 'overall' | Dimension;

export type EloRatings = Record<EloKey, number>;

/** What one article says about one TD. Dimension impacts are optional; the panel abstains often. */
export interface ArticleImpacts {
  overall: number;
  transparency?: number | null;
  effectiveness?: number | null;
  integrity?: number | null;
  consistency?: number | null;
}

export interface EloChange {
  key: EloKey;
  oldElo: number;
  newElo: number;
  delta: number;
  impact: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function baselineRatings(): EloRatings {
  return {
    overall: BASELINE_ELO,
    transparency: BASELINE_ELO,
    effectiveness: BASELINE_ELO,
    integrity: BASELINE_ELO,
    consistency: BASELINE_ELO,
  };
}

/**
 * Rating change for one impact.
 * @param impact −10..+10 (clamped)
 * @param credibility 0..1 (clamped); source credibility × panel confidence
 * @param ageDays days since the article was published
 */
export function eloDelta(impact: number, credibility: number, ageDays = 0): number {
  const i = clamp(impact, -10, 10);
  const c = clamp(credibility, 0, 1);
  let delta = (i / 10) * K_FACTOR * c;
  if (ageDays > DECAY_START_DAYS) {
    delta *= Math.pow(0.5, (ageDays - DECAY_START_DAYS) / DECAY_HALF_LIFE_DAYS);
  }
  return Math.round(delta);
}

/** Whole days between `published` and `now`, never negative. */
export function articleAgeDays(published: Date, now: Date = new Date()): number {
  const ms = now.getTime() - published.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Apply one article to a TD's ratings. Returns the new ratings and one change record per
 * rating that actually moved; a zero delta produces no record.
 */
export function applyArticle(
  current: EloRatings,
  impacts: ArticleImpacts,
  credibility: number,
  ageDays = 0,
): { updated: EloRatings; changes: EloChange[] } {
  const updated: EloRatings = { ...current };
  const changes: EloChange[] = [];

  const move = (key: EloKey, impact: number | null | undefined) => {
    if (impact === null || impact === undefined || impact === 0) return;
    const delta = eloDelta(impact, credibility, ageDays);
    if (delta === 0) return;
    const oldElo = current[key];
    const newElo = oldElo + delta;
    updated[key] = newElo;
    changes.push({ key, oldElo, newElo, delta, impact });
  };

  move('overall', impacts.overall);
  for (const d of DIMENSIONS) move(d, impacts[d]);

  return { updated, changes };
}

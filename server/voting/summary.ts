/**
 * The daily-session completion summary. Pure: every number comes from its arguments.
 *
 * The ideology shift is the ideology domain's profile after today's votes minus the
 * profile snapshot taken when the session opened. When no profile exists yet there is no
 * shift to show, and the summary says which way today's answers leaned instead. It never
 * invents a before/after pair.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '../constants/ideology';
import type {
  DailySessionCompletion,
  DailySessionDimensionShift,
  ShiftDirection,
} from '@shared/voting';
import type { OptionVector } from './questions';

export const AXIS_LABELS: Record<IdeologyDimension, string> = {
  economic: 'Economic Left - Right',
  social: 'Social Progressive - Conservative',
  cultural: 'Cultural Liberal - Traditional',
  authority: 'Authority Libertarian - Authoritarian',
  environmental: 'Climate Aggressive - Moderate',
  welfare: 'Welfare Expansive - Limited',
  globalism: 'Globalism International - National',
  technocratic: 'Technocratic Expert-Led - Populist',
};

/** A move smaller than this, in profile units, is reported as "held steady". */
const NEUTRAL_EPSILON = 0.0001;
const MAX_SHIFTS_SHOWN = 3;
const MS_PER_DAY = 86_400_000;

export const directionOf = (delta: number): ShiftDirection =>
  delta > NEUTRAL_EPSILON ? 'right' : delta < -NEUTRAL_EPSILON ? 'left' : 'neutral';

/** The calendar date a session belongs to, in the app's home time zone. */
export function sessionDateFor(now: Date, timeZone = 'Europe/Dublin'): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const dayNumber = (isoDate: string) => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / MS_PER_DAY);

/**
 * Consecutive completed days ending on `today`, counting today. `completedDates` are the
 * user's other completed session dates, in any order; today is included whether or not
 * the caller passes it.
 */
export function computeStreak(completedDates: string[], today: string): number {
  const days = new Set(completedDates.map(dayNumber));
  let cursor = dayNumber(today);
  days.add(cursor);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/** Per-axis profile change, largest first. Empty when either profile is missing. */
export function computeShifts(
  before: Partial<Record<string, number>> | null,
  after: Partial<Record<string, number>> | null,
): DailySessionDimensionShift[] {
  if (!before || !after) return [];
  return IDEOLOGY_DIMENSIONS.flatMap((dimension) => {
    const from = before[dimension];
    const to = after[dimension];
    if (typeof from !== 'number' || typeof to !== 'number') return [];
    const delta = to - from;
    if (Math.abs(delta) <= NEUTRAL_EPSILON) return [];
    return [
      {
        ideologyDimension: dimension,
        axisLabel: AXIS_LABELS[dimension],
        delta,
        deltaPercent: delta * 10,
        before: from,
        after: to,
        direction: directionOf(delta),
      },
    ];
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Weighted mean position of today's chosen options, per axis, −2..+2. */
export function leanOf(votes: Array<{ vector: OptionVector; weight: number }>): OptionVector | null {
  const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
  if (votes.length === 0 || totalWeight <= 0) return null;
  const lean = {} as OptionVector;
  for (const dimension of IDEOLOGY_DIMENSIONS) {
    lean[dimension] = votes.reduce((sum, vote) => sum + vote.vector[dimension] * vote.weight, 0) / totalWeight;
  }
  return lean;
}

/** Axes ordered by how strongly an area's votes pushed them, strongest first. */
export function rankAxes(totals: Partial<Record<IdeologyDimension, number>>): IdeologyDimension[] {
  return IDEOLOGY_DIMENSIONS.filter((d) => Math.abs(totals[d] ?? 0) > NEUTRAL_EPSILON).sort(
    (a, b) => Math.abs(totals[b] ?? 0) - Math.abs(totals[a] ?? 0),
  );
}

export interface RegionInput {
  /** 'county' | 'constituency', or null when the user has set neither. */
  kind: 'county' | 'constituency' | null;
  name: string | null;
  finishedToday: number;
  today: Partial<Record<IdeologyDimension, number>>;
  yesterday: Partial<Record<IdeologyDimension, number>> | null;
}

export function summariseRegion(
  region: RegionInput,
  focus: IdeologyDimension | null,
): Pick<DailySessionCompletion, 'regionSummary' | 'regionDimension' | 'regionPreviousRank' | 'regionCurrentRank'> {
  if (!region.kind) {
    return { regionSummary: 'Add your county or constituency to see how your area voted.' };
  }
  if (region.finishedToday === 0) {
    return { regionSummary: `You are the first in your ${region.kind} to finish today.` };
  }

  const rankedToday = rankAxes(region.today);
  const axis = focus && rankedToday.includes(focus) ? focus : rankedToday[0];
  if (!axis) {
    return { regionSummary: `${region.finishedToday} people in your ${region.kind} have finished today.` };
  }

  const label = AXIS_LABELS[axis].split(' ')[0]!;
  const place = region.name ? `${region.name}` : `your ${region.kind}`;
  const currentRank = rankedToday.indexOf(axis) + 1;
  const previousIndex = region.yesterday ? rankAxes(region.yesterday).indexOf(axis) : -1;
  const previousRank = previousIndex >= 0 ? previousIndex + 1 : undefined;

  let regionSummary: string;
  if (!previousRank) regionSummary = `${label} is the #${currentRank} issue in ${place} today.`;
  else if (previousRank === currentRank) regionSummary = `${place} held ${label} at #${currentRank} today.`;
  else regionSummary = `${place} moved ${label} from #${previousRank} to #${currentRank} today.`;

  return { regionSummary, regionDimension: axis, regionPreviousRank: previousRank, regionCurrentRank: currentRank };
}

const signedPercent = (value: number) => `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(1)}%`;

export function buildCompletion(input: {
  shifts: DailySessionDimensionShift[];
  lean: OptionVector | null;
  streakCount: number;
  voteCount: number;
  itemCount: number;
  region: ReturnType<typeof summariseRegion>;
}): DailySessionCompletion {
  const dominant = input.shifts[0] ?? null;
  const leanAxis = input.lean ? rankAxes(input.lean)[0] ?? null : null;

  let ideologyAxis = 'Overall';
  let ideologyDirection: ShiftDirection = 'neutral';
  let ideologyDelta = 0;
  let ideologySummary = 'Your answers today did not lean either way.';

  if (dominant) {
    ideologyAxis = dominant.axisLabel;
    ideologyDirection = dominant.direction;
    ideologyDelta = Math.abs(dominant.deltaPercent);
    ideologySummary = `Your profile moved ${signedPercent(dominant.deltaPercent)} on ${dominant.axisLabel}.`;
  } else if (leanAxis && input.lean) {
    ideologyAxis = AXIS_LABELS[leanAxis];
    ideologyDirection = directionOf(input.lean[leanAxis]);
    ideologySummary = `Your answers today leaned ${ideologyDirection} on ${ideologyAxis}.`;
  }

  const shown = input.shifts.slice(0, MAX_SHIFTS_SHOWN);
  return {
    ideologySummary,
    ideologyDelta,
    ideologyAxis,
    ideologyDirection,
    ...input.region,
    streakCount: input.streakCount,
    dimensionShifts: shown,
    detailStats: [
      ...shown.map((shift) => ({
        label: `${shift.axisLabel} axis`,
        value: `${signedPercent(shift.deltaPercent)} (${shift.before.toFixed(2)} → ${shift.after.toFixed(2)})`,
        emoji: shift.direction === 'left' ? '⬅️' : shift.direction === 'right' ? '➡️' : '⚖️',
      })),
      { label: 'Issues completed', value: `${input.voteCount} of ${input.itemCount}`, emoji: '🗳️' },
      { label: 'Streak', value: `${input.streakCount} day${input.streakCount === 1 ? '' : 's'}`, emoji: '🔥' },
    ],
  };
}

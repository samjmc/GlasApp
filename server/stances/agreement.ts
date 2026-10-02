/**
 * How often a TD answered the article questions the way a user did, blended into the axis
 * alignment. Pure: no I/O, the clock is passed in.
 *
 * The existing `alignment()` is not reused per item: fed two opposite options it never drops
 * below 80, because an option moves at most 2 of the 20-point span on a few axes. Here each
 * item is scaled by its own question's widest pair of options instead.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyVector } from '@shared/ideology';
import { decayFactor } from '../ideology/model';
import { QUOTE_KIND_WEIGHT, TD_HALF_LIFE_DAYS } from '../ideology/sources';
import type { QuoteKind } from './extract';

/** The axis alignment counts as this many full-weight shared issues. */
export const AXIS_PRIOR_WEIGHT = 2;
/** An item at or above this agreement counts as "agrees" in the breakdown. */
export const AGREE_THRESHOLD = 0.5;

/** A question's options by key, each with its eight-axis position (−2..+2). */
export type OptionPositions = Record<string, IdeologyVector>;

export interface AgreementItem {
  questionId: number;
  options: OptionPositions;
  userOption: string;
  tdOption: string;
  quoteKind: QuoteKind;
  statedAt: Date;
}

export type ScoredItem<T extends AgreementItem> = T & { agreement: number; weight: number };

export interface Agreement<T extends AgreementItem> {
  alignment: number;
  issues: { agree: number; disagree: number; items: Array<ScoredItem<T>> };
}

const distance = (a: IdeologyVector, b: IdeologyVector) =>
  IDEOLOGY_DIMENSIONS.reduce((sum, d) => sum + Math.abs(a[d] - b[d]), 0);

const has = (options: OptionPositions, key: string) => Object.prototype.hasOwnProperty.call(options, key);

/**
 * 1 for the same option, 0 for the question's two most distant options, linear between.
 * When the options do not differ (one option, or identical positions) only an exact match
 * counts. Null when either key is not one of the options (the bank changed).
 */
export function itemAgreement(options: OptionPositions, userOption: string, tdOption: string): number | null {
  if (!has(options, userOption) || !has(options, tdOption)) return null;
  if (userOption === tdOption) return 1;
  const keys = Object.keys(options);
  let widest = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      widest = Math.max(widest, distance(options[keys[i]!]!, options[keys[j]!]!));
    }
  }
  if (widest === 0) return 0;
  return 1 - distance(options[userOption]!, options[tdOption]!) / widest;
}

/** `kind × 0.5^(age / TD_HALF_LIFE_DAYS)`. */
export function stanceWeight(kind: QuoteKind, statedAt: Date, now: Date): number {
  return QUOTE_KIND_WEIGHT[kind] * decayFactor(statedAt, { now, halfLifeDays: TD_HALF_LIFE_DAYS });
}

/** A TD's current stance per question: the latest `statedAt` wins; on a tie, the first seen. */
export function latestStances<T extends { tdId: number; questionId: number; statedAt: Date }>(stances: T[]): T[] {
  const latest = new Map<string, T>();
  for (const stance of stances) {
    const key = `${stance.tdId}:${stance.questionId}`;
    const current = latest.get(key);
    if (!current || stance.statedAt.getTime() > current.statedAt.getTime()) latest.set(key, stance);
  }
  return Array.from(latest.values());
}

/**
 * `(Σ w·100·agree + PRIOR·axis) / (Σ w + PRIOR)`, rounded. With no usable items the result is
 * exactly `axis`. Items whose options no longer match the question are left out.
 */
export function agreementFor<T extends AgreementItem>(axis: number, items: T[], now: Date): Agreement<T> {
  const scored: Array<ScoredItem<T>> = [];
  for (const item of items) {
    const agreement = itemAgreement(item.options, item.userOption, item.tdOption);
    if (agreement === null) continue;
    scored.push({ ...item, agreement, weight: stanceWeight(item.quoteKind, item.statedAt, now) });
  }
  const agree = scored.filter((item) => item.agreement >= AGREE_THRESHOLD).length;
  const issues = { agree, disagree: scored.length - agree, items: scored };
  if (scored.length === 0) return { alignment: axis, issues };

  const weightSum = scored.reduce((sum, item) => sum + item.weight, 0);
  const itemSum = scored.reduce((sum, item) => sum + item.weight * 100 * item.agreement, 0);
  return { alignment: Math.round((itemSum + AXIS_PRIOR_WEIGHT * axis) / (weightSum + AXIS_PRIOR_WEIGHT)), issues };
}

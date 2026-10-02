/**
 * Which quiz questions a user is asked: the ONE rule, pure, shared by the client (which shows
 * the plan) and the server (which re-derives it from the seed to check what was shown).
 *
 * - Base: per dimension, the `basePerDimension` questions with the lowest rankOf(seed, id).
 *   It depends on the seed only, so every question is in the base for about half of users.
 * - Follow-ups: once every base question has an answer, a dimension whose base answers are not
 *   all on one side is flagged and gets up to `followUpsPerDimension` more, the next questions
 *   in its rank order. The most balanced dimension goes first; `followUpBudget` caps the total.
 *
 * Only base answers decide the follow-ups, so answering or changing a follow-up never moves
 * the plan.
 */
import { IDEOLOGY_LIMIT, type IdeologyDimension } from './ideology';
import { QUIZ_QUESTIONS, type QuizQuestion, type QuizResponse } from './quiz';

export const PLAN_VERSION = 1;

export interface QuizPlanConfig {
  basePerDimension: number;
  followUpsPerDimension: number;
  followUpBudget: number;
}

export const DEFAULT_PLAN_CONFIG: QuizPlanConfig = { basePerDimension: 3, followUpsPerDimension: 2, followUpBudget: 6 };
/** The go/no-go fallback: 4 questions per dimension, fixed per seed, and no follow-ups. */
export const FALLBACK_PLAN_CONFIG: QuizPlanConfig = { basePerDimension: 4, followUpsPerDimension: 0, followUpBudget: 0 };

export interface QuizPlan {
  /** Grouped by dimension in bank order, each group in rank order. */
  base: number[];
  /** Grouped the same way. */
  followUps: number[];
  /** The dimensions that got at least one follow-up, in bank order. */
  followUpDimensions: IdeologyDimension[];
}

/** What the server stores for a result whose answers match its plan. */
export interface QuizPlanRecord {
  v: typeof PLAN_VERSION;
  seed: number;
  base: number[];
  followUps: number[];
}

/** Question id → chosen answer index. */
type Answers = Readonly<Record<number, number>>;

/**
 * A per-seed rank for a question: murmur3's fmix32 over `seed ^ id·φ`. Integer arithmetic only,
 * so it is the same in every engine, and each step is a bijection, so two ids never tie.
 */
export function rankOf(seed: number, id: number): number {
  let h = seed ^ Math.imul(id, 0x9e3779b1);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Each answer's position on its own question: the strongest answer on each side is ±10 and 0
 * stays 0, so lopsided questions compare with symmetric ones.
 */
export function answerPositions(question: QuizQuestion): number[] {
  const values = question.answers.map((a) => a.value);
  const up = Math.max(...values);
  const down = -Math.min(...values);
  return values.map((v) => (v === 0 ? 0 : IDEOLOGY_LIMIT * (v > 0 ? v / up : v / down)));
}

function positionOf(question: QuizQuestion, index: number | undefined): number | undefined {
  return index !== undefined && Number.isInteger(index) ? answerPositions(question)[index] : undefined;
}

/** The bank's dimensions in order of first appearance, each with its questions in rank order. */
function rankedByDimension(seed: number, bank: readonly QuizQuestion[]) {
  const groups: Array<{ dimension: IdeologyDimension; questions: QuizQuestion[] }> = [];
  for (const q of bank) {
    const group = groups.find((g) => g.dimension === q.dimension);
    if (group) group.questions.push(q);
    else groups.push({ dimension: q.dimension, questions: [q] });
  }
  for (const g of groups) g.questions.sort((a, b) => rankOf(seed, a.id) - rankOf(seed, b.id) || a.id - b.id);
  return groups;
}

const balanceOf = (positions: number[]) => Math.abs(positions.reduce((s, p) => s + p, 0) / positions.length);

export function planQuiz(
  seed: number,
  answers: Answers,
  bank: readonly QuizQuestion[] = QUIZ_QUESTIONS,
  config: QuizPlanConfig = DEFAULT_PLAN_CONFIG,
): QuizPlan {
  const { basePerDimension, followUpsPerDimension } = config;
  const groups = rankedByDimension(seed, bank).map(({ dimension, questions }, order) => {
    const base = questions.slice(0, basePerDimension);
    return {
      dimension,
      order,
      base: base.map((q) => q.id),
      positions: base.map((q) => positionOf(q, answers[q.id])),
      candidates: questions.slice(basePerDimension, basePerDimension + followUpsPerDimension).map((q) => q.id),
      taken: [] as number[],
    };
  });
  const base = groups.flatMap((g) => g.base);
  // One decision point: nothing is added until the whole base is answered.
  if (groups.some((g) => g.positions.some((p) => p === undefined))) return { base, followUps: [], followUpDimensions: [] };

  const flagged = groups
    .map((g) => ({ g, positions: g.positions as number[] }))
    .filter(({ positions }) => !positions.every((p) => p > 0) && !positions.every((p) => p < 0))
    .sort((a, b) => balanceOf(a.positions) - balanceOf(b.positions) || a.g.order - b.g.order);
  let budget = config.followUpBudget;
  for (let r = 0; r < followUpsPerDimension; r++) {
    for (const { g } of flagged) {
      // A dimension with no r-th candidate is skipped and costs nothing.
      if (budget > 0 && r < g.candidates.length) {
        g.taken.push(g.candidates[r]);
        budget -= 1;
      }
    }
  }
  const followed = groups.filter((g) => g.taken.length > 0);
  return { base, followUps: followed.flatMap((g) => g.taken), followUpDimensions: followed.map((g) => g.dimension) };
}

/**
 * The order to show a question's answers in, as original answer indexes: Fisher–Yates driven by
 * an LCG started at rankOf. `j` comes from the high bits; `s % (i + 1)` on an LCG's low bits
 * reaches only 12 of the 24 orders of 4 answers.
 */
export function answerOrder(seed: number, id: number, n = 4): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  let s = rankOf(seed, id);
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((s / 2 ** 32) * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  return order;
}

/** The answers to submit: the plan's questions only, in plan order. Drops a follow-up that left the plan. */
export function responsesFor(plan: QuizPlan, answers: Answers): QuizResponse[] {
  return plan.base
    .concat(plan.followUps)
    .filter((id) => answers[id] !== undefined)
    .map((id) => ({ questionId: id, answerIndex: answers[id] }));
}

/** The plan record when the answered ids are exactly the plan's questions for this seed; otherwise null. */
export function verifyPlan(
  seed: number,
  responses: readonly QuizResponse[],
  bank: readonly QuizQuestion[] = QUIZ_QUESTIONS,
  config: QuizPlanConfig = DEFAULT_PLAN_CONFIG,
): QuizPlanRecord | null {
  if (!isQuizSeed(seed)) return null;
  const answers: Record<number, number> = {};
  for (const r of responses) answers[r.questionId] = r.answerIndex;
  const plan = planQuiz(seed, answers, bank, config);
  const shown = plan.base.concat(plan.followUps);
  const answered = new Set(responses.map((r) => r.questionId));
  if (answered.size !== shown.length || !shown.every((id) => answered.has(id))) return null;
  return { v: PLAN_VERSION, seed, base: plan.base, followUps: plan.followUps };
}

/** An integer 0..2^32−1. Anything else aliases under ToInt32 (2^32 ≡ 0, 1.5 ≡ 1), so it is rejected. */
export function isQuizSeed(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 0xffffffff;
}

export function newQuizSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

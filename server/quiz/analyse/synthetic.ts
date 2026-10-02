/**
 * Synthetic quiz rows for the item-analysis tests. The shared respondent model
 * (../testing/respondents: latent position, noise, per-question offset, closest option) answers
 * through the REAL adaptive planner, and each row carries the plan the server would store, so
 * the tests go through toRespondent exactly like a stored row. Each knob plants one defect;
 * respondents.ts itself is not edited.
 */
import { IDEOLOGY_DIMENSIONS, clampIdeologyValue, type IdeologyDimension } from '@shared/ideology';
import type { QuizQuestion } from '@shared/quiz';
import { planQuiz, responsesFor, verifyPlan } from '@shared/quizPlan';
import { chooseAnswer, itemOffsets, makeRespondents, mulberry32, symmetricQuestion, type Rng } from '../testing/respondents';
import type { QuizRow } from './exposures';

/**
 * 6 symmetric questions per dimension, ids 1–48 in dimension order. In each dimension the first
 * has twin strongest-negative answers (−S −S +M +S) and the second twin positive ones (−S −M +M +M).
 */
export const TEST_BANK: QuizQuestion[] = IDEOLOGY_DIMENSIONS.flatMap((d, k) =>
  [0, 1, 2, 3, 4, 5].map((j) => {
    const q = symmetricQuestion(1 + 6 * k + j, d);
    const twin = j === 0 ? [1, 0] : j === 1 ? [3, 2] : null; // [answer, takes the value of]
    return twin ? { ...q, answers: q.answers.map((a, i) => (i === twin[0] ? { ...a, value: q.answers[twin[1]].value } : a)) } : q;
  }),
);

/**
 * The noise multiplier for a realistic population: the 3-item base form's alpha is about 0.5
 * (0.52–0.54 per dimension over 4,000 synthetic users; at 1 it is 0.76–0.78).
 */
export const REALISTIC_NOISE = 2;

/** How often the `dominant` answer is forced. */
const DOMINANT_FORCED = 0.8;

export interface SyntheticOptions {
  n: number;
  seed: number;
  /** The true questions; default TEST_BANK. */
  bank?: readonly QuizQuestion[];
  /** Multiplies every respondent's answer noise; 1 = the shared model. */
  noise?: number;
  /** Answered uniformly at random: pure noise. */
  badItem?: number;
  /** Its values are negated in the bank the app scores with; people still answer it as written. */
  reversedItem?: number;
  /** This answer is forced for 80% of respondents. */
  dominant?: { id: number; answer: number };
  /** This answer is never picked (its neighbour is). */
  dead?: { id: number; answer: number };
  /** Dimension b's latent becomes r·a + √(1−r²)·b. */
  sharedLatent?: { a: IdeologyDimension; b: IdeologyDimension; r: number };
}

export interface Synthetic {
  /** The bank the app scores and plans with (reversedItem negated). */
  bank: QuizQuestion[];
  rows: QuizRow[];
  /** Each respondent's answer to every question, as if all were asked. */
  full: Array<Record<number, number>>;
}

function pick(q: QuizQuestion, latent: number, offset: number, noise: number, o: SyntheticOptions, rng: Rng): number {
  if (q.id === o.badItem) return Math.floor(rng() * q.answers.length);
  if (q.id === o.dominant?.id && rng() < DOMINANT_FORCED) return o.dominant.answer;
  let i = chooseAnswer(q, latent, offset, noise, rng);
  // Twins share a position and chooseAnswer always returns the first; a person picks either.
  const twins = q.answers.flatMap((a, k) => (a.value === q.answers[i].value ? [k] : []));
  if (twins.length > 1) i = twins[Math.floor(rng() * twins.length)];
  if (q.id === o.dead?.id && i === o.dead.answer) i = i > 0 ? i - 1 : 1;
  return i;
}

export function synthesise(o: SyntheticOptions): Synthetic {
  const rng = mulberry32(o.seed);
  const truth = o.bank ?? TEST_BANK;
  const bank = truth.map((q) => (q.id === o.reversedItem ? { ...q, answers: q.answers.map((a) => ({ ...a, value: -a.value })) } : q));
  const offsets = itemOffsets(truth, rng);
  const rows: QuizRow[] = [];
  const full: Array<Record<number, number>> = [];
  for (const person of makeRespondents(o.n, rng)) {
    const latent = { ...person.latent };
    if (o.sharedLatent) {
      const { a, b, r } = o.sharedLatent;
      latent[b] = clampIdeologyValue(r * latent[a] + Math.sqrt(1 - r * r) * latent[b]);
    }
    const answers: Record<number, number> = {};
    for (const q of truth) answers[q.id] = pick(q, latent[q.dimension], offsets.get(q.id)!, person.noise * (o.noise ?? 1), o, rng);
    // The base depends on the seed only; the follow-ups on the base answers.
    const seed = Math.floor(rng() * 2 ** 32);
    const { base } = planQuiz(seed, {}, bank);
    const plan = planQuiz(seed, Object.fromEntries(base.map((id) => [id, answers[id]])), bank);
    const responses = responsesFor(plan, answers);
    rows.push({ answers: responses, plan: verifyPlan(seed, responses, bank) });
    full.push(answers);
  }
  return { bank, rows, full };
}

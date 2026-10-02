/**
 * A simulated quiz population, for tests: who answers, how, and the 48-question pool the
 * planner is built for. Nothing in the app imports this file; plan 05's item analysis reuses it.
 */
import {
  IDEOLOGY_DIMENSIONS,
  clampIdeologyValue,
  emptyIdeologyVector,
  type IdeologyDimension,
  type IdeologyVector,
} from '@shared/ideology';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { answerPositions } from '@shared/quizPlan';

export type Rng = () => number;

/** A small seeded PRNG, uniform on [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One standard normal draw (Box–Muller). */
export function gaussian(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

export interface Respondent {
  latent: IdeologyVector;
  /** The sd of the answer noise, on the answer-position scale (answerPositions). */
  noise: number;
}

/**
 * Half centrists, N(0, 3) on each dimension; half partisans, ±6 on each dimension (the sign
 * drawn per dimension) plus N(0, 2.5). Clamped to ±10. Answer noise is 3 for 70%, 6 for 30%.
 */
export function makeRespondents(n: number, rng: Rng): Respondent[] {
  return Array.from({ length: n }, (_, i) => {
    const latent = emptyIdeologyVector();
    for (const d of IDEOLOGY_DIMENSIONS) {
      latent[d] = clampIdeologyValue(i % 2 === 0 ? 3 * gaussian(rng) : (rng() < 0.5 ? -6 : 6) + 2.5 * gaussian(rng));
    }
    return { latent, noise: rng() < 0.7 ? 3 : 6 };
  });
}

/** Per question, how far it reads from its dimension's true position: N(0, 1.5). */
export function itemOffsets(bank: readonly QuizQuestion[], rng: Rng): Map<number, number> {
  return new Map<number, number>(bank.map((q) => [q.id, 1.5 * gaussian(rng)]));
}

/** The answer whose position (answerPositions, not the raw value) is closest to latent + offset + N(0, noise). */
export function chooseAnswer(question: QuizQuestion, latent: number, offset: number, noise: number, rng: Rng): number {
  const target = latent + offset + noise * gaussian(rng);
  const positions = answerPositions(question);
  let best = 0;
  for (let i = 1; i < positions.length; i++) {
    if (Math.abs(positions[i] - target) < Math.abs(positions[best] - target)) best = i;
  }
  return best;
}

/** A question with the symmetric answers −S, −M, +M, +S: 2.5/1.25 on economic, 3.33/1.67 elsewhere. */
export function symmetricQuestion(id: number, dimension: IdeologyDimension): QuizQuestion {
  const [strong, mild] = dimension === 'economic' ? [2.5, 1.25] : [3.33, 1.67];
  return {
    id,
    dimension,
    text: `Synthetic Q${id}`,
    answers: [-strong, -mild, mild, strong].map((value) => ({ value, text: String(value), description: '' })),
  };
}

/**
 * The real bank plus 22 symmetric stand-ins, 6 per dimension, on the ids the new questions
 * will take: 28 economic, then 3 each for social through technocratic (29–49).
 */
export const BANK_48: QuizQuestion[] = [
  ...QUIZ_QUESTIONS,
  symmetricQuestion(28, 'economic'),
  ...IDEOLOGY_DIMENSIONS.slice(1).flatMap((d, k) => [0, 1, 2].map((j) => symmetricQuestion(29 + 3 * k + j, d))),
];

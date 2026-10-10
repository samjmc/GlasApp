/**
 * How a robot answers, from its position (docs/plans/robot-run.md). Seeded, so a run repeats.
 * Quiz answers reuse the test population model (server/quiz/testing/respondents.ts); this file
 * adds the two choices that model does not cover: a policy option, and a pledge ranking.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyVector } from '@shared/ideology';
import { PLEDGE_CATEGORIES, type PledgeCategory } from '@shared/pledges';
import { QUIZ_QUESTIONS, type QuizResponse } from '@shared/quiz';
import { planQuiz, responsesFor } from '@shared/quizPlan';
import { chooseAnswer, gaussian, type Rng } from '../../quiz/testing/respondents';

/** A vote counts 5× its option vector on the profile's ±10 ruler (server/ideology/sources.ts). */
export const OPTION_SCALE = 5;

export type OptionVectors = Record<string, Partial<Record<(typeof IDEOLOGY_DIMENSIONS)[number], number>>>;

/**
 * The option nearest `latent` + noise. Only dimensions where some option of this question says
 * something count: a 0 on every option means "says nothing", and would otherwise make a flat
 * option win for everyone near the centre.
 */
export function nearestOption(options: OptionVectors, latent: IdeologyVector, noise: number, rng: Rng): string {
  const keys = Object.keys(options).sort();
  if (keys.length === 0) throw new Error('nearestOption needs at least one option');
  const used = IDEOLOGY_DIMENSIONS.filter((d) => keys.some((k) => (options[k]![d] ?? 0) !== 0));
  if (used.length === 0) return keys[Math.floor(rng() * keys.length)]!;
  const target = Object.fromEntries(used.map((d) => [d, latent[d] + noise * gaussian(rng)]));
  let best = keys[0]!;
  let bestDistance = Infinity;
  for (const key of keys) {
    const distance = used.reduce((sum, d) => sum + (OPTION_SCALE * (options[key]![d] ?? 0) - target[d]!) ** 2, 0);
    if (distance < bestDistance) [best, bestDistance] = [key, distance];
  }
  return best;
}

/** The rankable pledge categories (everything but the catch-all), in a seeded order. */
export function pledgeRanking(rng: Rng): PledgeCategory[] {
  const ranking = PLEDGE_CATEGORIES.filter((c) => c !== 'other');
  for (let i = ranking.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ranking[i], ranking[j]] = [ranking[j]!, ranking[i]!];
  }
  return ranking;
}

/**
 * The quiz as the client takes it (client/src/pages/QuizPage.tsx), so the server stores its plan:
 * the base for `seed`, then the follow-ups those answers earn. As server/quiz/analyse/synthetic.ts,
 * a twin answer (two answers with one value) is picked at random between the twins.
 */
export function takeQuiz(seed: number, latent: IdeologyVector, noise: number, offsets: Map<number, number>, rng: Rng): QuizResponse[] {
  const byId = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q]));
  const answers: Record<number, number> = {};
  const answer = (ids: number[]) => {
    for (const id of ids) {
      const q = byId.get(id)!;
      let i = chooseAnswer(q, latent[q.dimension], offsets.get(id) ?? 0, noise, rng);
      const twins = q.answers.flatMap((a, k) => (a.value === q.answers[i]!.value ? [k] : []));
      if (twins.length > 1) i = twins[Math.floor(rng() * twins.length)]!;
      answers[id] = i;
    }
  };
  answer(planQuiz(seed, {}).base);
  const plan = planQuiz(seed, answers);
  answer(plan.followUps);
  return responsesFor(plan, answers);
}

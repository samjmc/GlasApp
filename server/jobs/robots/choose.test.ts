import { describe, expect, it } from 'vitest';
import { emptyIdeologyVector } from '@shared/ideology';
import { PLEDGE_CATEGORIES } from '@shared/pledges';
import { QUIZ_QUESTIONS } from '@shared/quiz';
import { verifyPlan } from '@shared/quizPlan';
import { itemOffsets, makeRespondents, mulberry32 } from '../../quiz/testing/respondents';
import { nearestOption, pledgeRanking, takeQuiz } from './choose';

describe('robot choices', () => {
  const left = { ...emptyIdeologyVector(), economic: -8 };
  const right = { ...emptyIdeologyVector(), economic: 8 };

  it('votes for the option nearest its position, on the dimensions the question speaks to', () => {
    const options = { option_a: { economic: -1.5 }, option_b: { economic: 1.5 }, option_c: { economic: 0 } };
    expect(nearestOption(options, left, 0, mulberry32(1))).toBe('option_a');
    expect(nearestOption(options, right, 0, mulberry32(1))).toBe('option_b');
  });

  it('ignores a dimension no option speaks to, so a flat option does not win for the centre', () => {
    // Only `social` is used; the robot is strongly social-positive, neutral elsewhere.
    const options = { option_a: { social: 1.8 }, option_b: { social: -1.8 }, option_c: {} };
    const robot = { ...emptyIdeologyVector(), social: 9 };
    expect(nearestOption(options, robot, 0, mulberry32(2))).toBe('option_a');
  });

  it('is deterministic for a seed', () => {
    const options = { option_a: { welfare: -1 }, option_b: { welfare: 1 } };
    const draws = (seed: number) => Array.from({ length: 20 }, (_, i) => nearestOption(options, { ...emptyIdeologyVector(), welfare: i - 10 }, 3, mulberry32(seed + i)));
    expect(draws(7)).toEqual(draws(7));
  });

  it('ranks every rankable pledge category exactly once', () => {
    const ranking = pledgeRanking(mulberry32(3));
    expect([...ranking].sort()).toEqual(PLEDGE_CATEGORIES.filter((c) => c !== 'other').sort());
    expect(new Set(ranking).size).toBe(ranking.length);
  });

  it('takes the quiz the way the client does, so the server would store its plan', () => {
    const rng = mulberry32(4);
    const people = makeRespondents(25, rng);
    const offsets = itemOffsets(QUIZ_QUESTIONS, rng);
    for (const [i, person] of people.entries()) {
      const seed = 1000 + i;
      const responses = takeQuiz(seed, person.latent, person.noise, offsets, rng);
      expect(responses.length).toBeGreaterThan(0);
      expect(verifyPlan(seed, responses), `respondent ${i}`).not.toBeNull();
    }
  });
});

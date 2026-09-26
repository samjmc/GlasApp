import { describe, expect, it } from 'vitest';
import type { QuizQuestion } from '@shared/quiz';
import { questionFingerprint } from './fingerprint';

// Q1 as it stood on 2026-09-25, frozen here so the golden pins the formula, not the bank.
const Q1: QuizQuestion = {
  id: 1,
  dimension: 'economic',
  text: "How should a €3bn budget surplus be used when only one priority can be funded?",
  answers: [
    { value: -2.5, text: "Accelerate national infrastructure like transport and housing even if debt rises short term", description: "Back a state-led building surge that keeps timelines tight and national outcomes front of mind." },
    { value: -2.5, text: "Expand targeted social supports such as healthcare cost relief and income floors", description: "Channel the windfall into safety-net programmes designed around the most vulnerable households." },
    { value: 2.5, text: "Deliver broad-based tax relief so households and SMEs feel an immediate dividend", description: "Return the surplus directly to earners and firms to stimulate private choice and investment." },
    { value: 1.25, text: "Bank the funds in a resilience reserve for future shocks and major contingencies", description: "Keep powder dry and let experts deploy the capital when a strategic threat or opportunity appears." },
  ],
};

const edit = (change: (q: QuizQuestion) => void): QuizQuestion => {
  const q = structuredClone(Q1);
  change(q);
  return q;
};

describe('questionFingerprint', () => {
  it('is the first 8 hex of sha256 over what a respondent reads (golden value for Q1)', () => {
    expect(questionFingerprint(Q1)).toBe('1ef56c01');
  });

  it('ignores answer values, so re-weighting a question rescores party answers instead of staling them', () => {
    const reweighted = edit((q) => {
      q.answers[0]!.value = -5;
      q.answers[3]!.value = 2.5;
    });
    expect(questionFingerprint(reweighted)).toBe(questionFingerprint(Q1));
  });

  it('changes on any edit to the text, an answer text, a description, the dimension or the answer order', () => {
    const edits: Array<[string, QuizQuestion]> = [
      ['text', edit((q) => { q.text += ' Now?'; })],
      ['answer text', edit((q) => { q.answers[1]!.text = 'Expand targeted social supports'; })],
      ['description', edit((q) => { q.answers[2]!.description = 'Return the surplus.'; })],
      ['dimension', edit((q) => { q.dimension = 'welfare'; })],
      ['answer order', edit((q) => { q.answers.reverse(); })],
    ];
    for (const [what, changed] of edits) expect(questionFingerprint(changed), what).not.toBe(questionFingerprint(Q1));
  });
});

import { describe, expect, it } from 'vitest';
import { emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';
import type { PartyQuizSheet } from '@shared/partyQuiz';
import type { QuizQuestion } from '@shared/quiz';
import { questionFingerprint } from '../quiz/fingerprint';
import { parseChesCsv, partyReport } from './report';

// Invented bank: two economic and two social questions, answers valued −2, −1, +1, +2.
const BANK: QuizQuestion[] = [
  ...[1, 2].map((id) => ({ id, dimension: 'economic' as const })),
  ...[3, 4].map((id) => ({ id, dimension: 'social' as const })),
].map(({ id, dimension }) => ({
  id, dimension, text: `Invented question ${id}?`,
  answers: [-2, -1, 1, 2].map((value, a) => ({ value, text: `Answer ${a}`, description: `Reason ${a}` })),
}));
const vec = (over: Partial<IdeologyVector>): IdeologyVector => ({ ...emptyIdeologyVector(), ...over });
// Fine Gael's manifesto takes the most market answer on both economic questions: m = +10, c = 1.
const SHEET: PartyQuizSheet = {
  party: 'Fine Gael', election: 'ge2024', documents: [], model: 'deepseek-flash', promptVersion: 'v1',
  items: [1, 2].map((id) => ({
    questionId: id, fingerprint: questionFingerprint(BANK[id - 1]!), status: 'answered' as const, answerIndex: 3, abstainReason: null,
    quotes: [], rationale: '', modelConfidence: 0.9, review: 'approved' as const,
  })),
};
const ROWS = [
  { party: 'Fine Gael', vector: vec({ economic: -4 }) },
  { party: 'Sinn Féin', vector: vec({ economic: 2 }) },
];

describe('partyReport', () => {
  const report = partyReport({ sheets: [SHEET], bank: BANK, rows: ROWS, ches: parseChesCsv('party,economic,nonsense\nFine Gael,7,1\n') });

  it('shows m, the baseline, the stored TD mean and the blend, and flags a large gap at high coverage', () => {
    expect(report).toContain('| Fine Gael | economic | 10.0 | 1.00 | 1.5 | -4 | 10 | CHECK |');
    expect(report).toContain('| Fine Gael | social | 0.0 | 0.00 | 1 | 0 | 0 |  |');
    expect(report).toContain('- Fine Gael economic: m 10.0, baseline 1.5, c 1.00');
  });

  it('prints the coverage matrix', () => {
    expect(report).toContain('| Fine Gael | 2/4 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |');
  });

  it('prints the party order for all -10, all +10 and all 0, before and after the blend', () => {
    expect(report).toMatch(/all \+10: before Sinn Féin \(\d+\), Fine Gael \(\d+\); after Fine Gael \(\d+\), Sinn Féin \(\d+\)/);
    expect(report).toMatch(/all -10: before Fine Gael \(\d+\), Sinn Féin \(\d+\); after Sinn Féin/);
    expect(report).toMatch(/all 0: before /);
  });

  it('compares m with a CHES file on the dimensions it has', () => {
    expect(report).toContain('- Fine Gael economic: m 10.0, CHES 7, difference 3.0');
    expect(report).not.toContain('nonsense');
  });

  it('says so when no party has a manifesto position yet', () => {
    expect(partyReport({ sheets: [], bank: BANK, rows: ROWS })).toContain('No party has an approved, current manifesto answer yet.');
  });
});

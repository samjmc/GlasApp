import { describe, expect, it } from 'vitest';
import type { PartyQuizItem, PartyQuizQuote, PartyQuizSheet } from '@shared/partyQuiz';
import type { QuizQuestion } from '@shared/quiz';
import { questionFingerprint } from '../quiz/fingerprint';
import { manifestoPosition } from './position';
import type { ManifestoDocument } from './registry';
import { MAX_ANSWER_QUESTIONS, answersForQuestions, partyAnswers } from './serve';

// Invented bank, documents and quotes.
const BANK: QuizQuestion[] = [1, 2, 3, 4, 5, 6].map((id) => ({
  id, dimension: 'economic', text: `Invented question ${id}?`,
  answers: [-2, -1, 1, 2].map((value, a) => ({ value, text: `Answer ${a} to ${id}`, description: `Reason ${a}` })),
}));
const doc = (slug: string, party: string, url: string | null, format: ManifestoDocument['format']): ManifestoDocument => ({
  slug, party, election: 'ge2024', title: `Title of ${slug}`, url, mirrorUrl: null, format,
  sha256: 'a'.repeat(64), wordCount: 20_000, retrieved: '2026-09-25', licenceChecked: true,
});
const REGISTRY = [
  doc('fg-pdf', 'Fine Gael', 'https://example.ie/fg.pdf', 'pdf'),
  doc('sf-html', 'Sinn Féin', 'https://example.ie/sf', 'html'),
  doc('lab-pdf', 'Labour Party', null, 'pdf'),
];

const PDF_QUOTE: PartyQuizQuote = { document: 'fg-pdf', page: 12, pageLabel: '10', text: 'We will cut the income tax paid by every worker in the country.', quoteSha: 'x' };
const HTML_QUOTE: PartyQuizQuote = { document: 'sf-html', page: 3, pageLabel: null, text: 'A well-being budget will put people first in every decision we make.', quoteSha: 'y' };

const item = (questionId: number, over: Partial<PartyQuizItem> = {}): PartyQuizItem => ({
  questionId, fingerprint: questionFingerprint(BANK[questionId - 1]!), status: 'answered', answerIndex: 3, abstainReason: null,
  quotes: [PDF_QUOTE], rationale: 'Cuts income tax for every worker.', modelConfidence: 0.8, review: 'approved', ...over,
});
const sheetOf = (party: string, items: PartyQuizItem[]): PartyQuizSheet => ({
  party, election: 'ge2024', documents: [], model: 'deepseek-flash', promptVersion: 'v1', items,
});
const FG = sheetOf('Fine Gael', [
  item(1),
  item(2, { review: 'pending' }),
  item(3, { review: 'rejected' }),
  item(4, { fingerprint: 'deadbeef' }), // the question changed after it was answered
  item(5, { status: 'abstained', answerIndex: null, abstainReason: 'silent', quotes: [] }),
  item(6, { stale: true }),
]);
const SF = sheetOf('Sinn Féin', [item(1, { answerIndex: 0, quotes: [HTML_QUOTE] })]);
const SHEETS = [FG, SF];

describe('partyAnswers', () => {
  it('serves only approved items for the question as the bank has it: never pending, rejected or stale', () => {
    const fg = partyAnswers('fine gael', SHEETS, REGISTRY, BANK)!;
    expect(fg.answers.map((a) => a.questionId)).toEqual([1, 5]);
    expect(fg.pendingCount).toBe(1);
    expect(fg.position).toEqual(manifestoPosition('Fine Gael', SHEETS, BANK));
    expect(fg.position?.answeredCount).toBe(1);
  });

  it('sends an answer with its value and each quote linked to its PDF page', () => {
    const fg = partyAnswers('Fine Gael', SHEETS, REGISTRY, BANK)!;
    expect(fg).toMatchObject({ party: 'Fine Gael', election: 'ge2024', documents: [{ slug: 'fg-pdf', title: 'Title of fg-pdf', url: 'https://example.ie/fg.pdf' }] });
    expect(fg.answers[0]).toEqual({
      party: 'Fine Gael', questionId: 1, answered: true, answerIndex: 3, value: 2, rationale: 'Cuts income tax for every worker.',
      abstainReason: null, modelConfidence: 0.8,
      citations: [{
        document: 'fg-pdf', title: 'Title of fg-pdf', url: 'https://example.ie/fg.pdf', pdfPage: 12, page: '10',
        href: 'https://example.ie/fg.pdf#page=12', quote: PDF_QUOTE.text,
      }],
    });
  });

  it('serves an approved abstention with answered: false', () => {
    const abstention = partyAnswers('Fine Gael', SHEETS, REGISTRY, BANK)!.answers.find((a) => a.questionId === 5);
    expect(abstention).toMatchObject({ answered: false, answerIndex: null, value: null, abstainReason: 'silent', citations: [] });
  });

  it('links an HTML quote with a text fragment of its first six words, "-" escaped', () => {
    const [citation] = partyAnswers('Sinn Féin', SHEETS, REGISTRY, BANK)!.answers[0]!.citations;
    expect(citation).toMatchObject({ pdfPage: null, page: '3' });
    expect(citation!.href).toBe('https://example.ie/sf#:~:text=A%20well%2Dbeing%20budget%20will%20put%20people');
  });

  it('is null for a party with neither a document nor a sheet; a registered party with no sheet has no answers', () => {
    expect(partyAnswers('Nobody', SHEETS, REGISTRY, BANK)).toBeNull();
    expect(partyAnswers('Labour', SHEETS, REGISTRY, BANK)).toEqual({
      party: 'Labour Party', election: 'ge2024', documents: [{ slug: 'lab-pdf', title: 'Title of lab-pdf', url: null }],
      position: null, pendingCount: 0, answers: [],
    });
  });

  it('with the compiled-in sheets (none yet), a registered party has documents and no answers', () => {
    expect(partyAnswers('Fine Gael')).toMatchObject({ party: 'Fine Gael', position: null, pendingCount: 0, answers: [] });
    expect(partyAnswers('Fine Gael')!.documents.map((d) => d.slug)).toEqual(['fg-ge2024']);
  });
});

describe('answersForQuestions', () => {
  it('gives every party\'s served answers per question, and [] for a question with none', () => {
    const byQuestion = answersForQuestions([1, 5, 2, 99], SHEETS, REGISTRY, BANK);
    expect(Object.keys(byQuestion).sort()).toEqual(['1', '2', '5', '99']);
    expect(byQuestion[1]!.map((a) => [a.party, a.answerIndex])).toEqual([['Fine Gael', 3], ['Sinn Féin', 0]]);
    expect(byQuestion[5]!.map((a) => a.answered)).toEqual([false]);
    expect(byQuestion[2]).toEqual([]);
    expect(byQuestion[99]).toEqual([]);
  });

  it(`refuses more than ${MAX_ANSWER_QUESTIONS} questions`, () => {
    const ids = Array.from({ length: MAX_ANSWER_QUESTIONS + 1 }, (_, i) => i + 1);
    expect(() => answersForQuestions(ids, SHEETS, REGISTRY, BANK)).toThrow(RangeError);
    expect(() => answersForQuestions(ids.slice(1), SHEETS, REGISTRY, BANK)).not.toThrow();
  });
});

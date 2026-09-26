import { describe, expect, it } from 'vitest';
import type { PartyQuizItem, PartyQuizSheet } from '@shared/partyQuiz';
import type { QuizQuestion } from '@shared/quiz';
import { questionFingerprint } from '../quiz/fingerprint';
import type { StoredPage } from './extract';
import { quoteSha } from './normalise';
import type { ManifestoDocument } from './registry';
import { approve, citationHref, editItem, markStale, recheckQuotes, reviewTable } from './review';

// Invented bank, document and quotes: no manifesto is quoted in this repo.
const BANK: QuizQuestion[] = [1, 2, 3].map((id) => ({
  id, dimension: 'environmental', text: `Invented question ${id}? It has a | pipe`,
  answers: ['A', 'B', 'C', 'D'].map((a, v) => ({ value: v - 1.5, text: `Answer ${a}`, description: `Reason ${a}` })),
}));
const QUOTE = 'We will pay a warden for every river in every county';
const OTHER = 'Every village library will open on Sunday afternoons with volunteer help';
const PAGES: StoredPage[] = [
  { ordinal: 1, label: 'i', heading: null, text: 'Contents and a foreword that says nothing.' },
  { ordinal: 2, label: '1', heading: null, text: `${QUOTE} by the end of the term.` },
  { ordinal: 3, label: '2', heading: null, text: `${OTHER}.` },
];
const DOCS = new Map([['x-ge2024', PAGES]]);
const REGISTRY: ManifestoDocument[] = [{
  slug: 'x-ge2024', party: 'Green Party', election: 'ge2024', title: 'Invented', url: 'https://example.ie/x.pdf', mirrorUrl: null,
  format: 'pdf', sha256: 'a'.repeat(64), wordCount: 20_000, retrieved: '2026-09-26', licenceChecked: true,
}];

const quote = (text: string, page: number) => ({ document: 'x-ge2024', page, pageLabel: String(page - 1), text, quoteSha: quoteSha(text) });
const item = (questionId: number, over: Partial<PartyQuizItem> = {}): PartyQuizItem => ({
  questionId, fingerprint: questionFingerprint(BANK[questionId - 1]!), status: 'answered', answerIndex: 2, abstainReason: null,
  quotes: [quote(QUOTE, 2)], rationale: 'Promises wardens.', modelConfidence: 0.8, review: 'pending', ...over,
});
const SHEET: PartyQuizSheet = {
  party: 'Green Party', election: 'ge2024', documents: ['x-ge2024'], model: 'deepseek-flash', promptVersion: 'v1',
  items: [
    item(1),
    item(2, { status: 'abstained', answerIndex: null, abstainReason: 'low_confidence', tentativeAnswerIndex: 1, quotes: [], modelConfidence: 0.3 }),
    item(3, { status: 'abstained', answerIndex: null, abstainReason: 'silent', quotes: [] }),
  ],
};

describe('reviewTable', () => {
  it('prints one Markdown row per item, with the answer text, linked quotes and escaped pipes', () => {
    const table = reviewTable(SHEET, REGISTRY, BANK);
    const rows = table.split('\n').filter((l) => l.startsWith('| '));
    expect(rows).toHaveLength(4);
    expect(rows[1]).toBe(`| 1 | Invented question 1? It has a \\| pipe | 2: Answer C | "${QUOTE}" ([p. 1](https://example.ie/x.pdf#page=2)) | Promises wardens. | 0.80 | pending |`);
    expect(rows[2]).toContain('| abstained (low_confidence), leaned 1: Answer B |');
    expect(rows[3]).toContain('| abstained (silent) |');
    expect(table).toContain('3 items: 1 answered, 2 abstained; 3 pending');
  });

  it('links an HTML quote with a text fragment of its first six words', () => {
    const html = { ...REGISTRY[0]!, format: 'html' as const, url: 'https://example.ie/plan' };
    expect(citationHref(html, quote(QUOTE, 2))).toBe('https://example.ie/plan#:~:text=We%20will%20pay%20a%20warden%20for');
    expect(citationHref({ ...html, url: null }, quote(QUOTE, 2))).toBeNull();
  });
});

describe('approve', () => {
  it('approves the listed items, or every pending one, abstentions included', () => {
    expect(approve(SHEET, [1, 3]).items.map((i) => i.review)).toEqual(['approved', 'pending', 'approved']);
    expect(approve(SHEET, 'all-pending').items.every((i) => i.review === 'approved')).toBe(true);
    expect(() => approve(SHEET, [9])).toThrow(/Q9/);
  });
});

describe('editItem', () => {
  it("replaces the answer and the model's quotes with a verified reviewer quote and note", () => {
    const edited = editItem(SHEET, { question: 2, answer: 3, quotePage: 3, quote: OTHER, note: 'The library pledge settles it.' }, DOCS, BANK);
    expect(edited.items[1]).toEqual({
      questionId: 2, fingerprint: questionFingerprint(BANK[1]!), status: 'answered', answerIndex: 3, abstainReason: null,
      quotes: [{ document: 'x-ge2024', page: 3, pageLabel: '2', text: OTHER, quoteSha: quoteSha(OTHER) }],
      rationale: 'The library pledge settles it.', modelConfidence: 0.3, review: 'approved', reviewerEdited: true, reviewNote: 'The library pledge settles it.',
    });
    expect(edited.items[0]).toEqual(SHEET.items[0]);
  });

  it('refuses a quote that is not in the stored text, an answer out of range and an empty note', () => {
    const edit = { question: 2, answer: 3, quotePage: 3, quote: 'Every farmer will be paid to fence off every river bank', note: 'n' };
    expect(() => editItem(SHEET, edit, DOCS, BANK)).toThrow(/not found/);
    expect(() => editItem(SHEET, { ...edit, quote: OTHER, answer: 4 }, DOCS, BANK)).toThrow(/answer/);
    expect(() => editItem(SHEET, { ...edit, quote: OTHER, note: ' ' }, DOCS, BANK)).toThrow(/note/);
  });
});

describe('markStale', () => {
  it('marks items whose question changed or left the bank, and clears the mark when it matches again', () => {
    const edited = structuredClone(BANK);
    edited[0]!.text = 'Invented question 1, reworded?';
    const { sheet, changed } = markStale(SHEET, edited.slice(0, 2));
    expect(changed).toEqual([1, 3]);
    expect(sheet.items.map((i) => i.stale ?? false)).toEqual([true, false, true]);
    expect(markStale(sheet, BANK).sheet.items.map((i) => i.stale ?? false)).toEqual([false, false, false]);
  });
});

describe('recheckQuotes', () => {
  it('re-verifies every quote against the store, moving a page and re-stamping the sha', () => {
    const moved = structuredClone(SHEET);
    moved.items[0]!.quotes = [{ ...quote(QUOTE, 3), quoteSha: 'stale' }];
    const { sheet, problems } = recheckQuotes(moved, DOCS);
    expect(problems).toEqual([]);
    expect(sheet.items[0]!.quotes[0]).toEqual({ ...quote(QUOTE, 2), pageLabel: '1', pageCorrected: true });
  });

  it('reports a quote the store does not have', () => {
    const bad = structuredClone(SHEET);
    bad.items[0]!.quotes[0]!.text = 'Every farmer will be paid to fence off every river bank';
    expect(recheckQuotes(bad, DOCS).problems).toEqual([expect.stringMatching(/Q1: quote 1 .*not found/)]);
    expect(recheckQuotes(SHEET, new Map()).problems).toEqual([expect.stringMatching(/x-ge2024 is not in the text store/)]);
  });
});

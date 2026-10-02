import { describe, expect, it } from 'vitest';
import { transformSync } from 'esbuild';
import type { PartyQuizItem, PartyQuizQuote, PartyQuizSheet } from '@shared/partyQuiz';
import { quoteSha } from './normalise';
import type { ManifestoDocument } from './registry';
import { renderIndexSource, renderSheetSource, sheetFile, validateSheet } from './sheet';

// Invented text and documents: no manifesto is quoted in this repo.
const words = (n: number, seed = 0) => Array.from({ length: n }, (_, i) => `word${seed}n${i}`).join(' ');

const doc = (slug: string, party: string, wordCount: number): ManifestoDocument => ({
  slug, party, election: 'ge2024', title: slug, url: `https://example.ie/${slug}.pdf`, mirrorUrl: null, format: 'pdf',
  sha256: 'a'.repeat(64), wordCount, retrieved: '2026-09-25', licenceChecked: true,
});
// small: cap = 5% of 2,000 = 100 words. big: 5% would be 50,000, so the 3,000 cap applies.
const REGISTRY = [doc('small-ge2024', 'Fine Gael', 2_000), doc('big-ge2024', 'Fine Gael', 1_000_000)];

const quote = (text: string, document = 'small-ge2024'): PartyQuizQuote => ({ document, page: 1, pageLabel: null, text, quoteSha: quoteSha(text) });
const item = (questionId: number, over: Partial<PartyQuizItem> = {}): PartyQuizItem => ({
  questionId, fingerprint: '0000abcd', status: 'answered', answerIndex: 0, abstainReason: null,
  quotes: [quote(words(8, questionId))], rationale: 'Says so on page 1.', modelConfidence: 0.9, review: 'pending', ...over,
});
const sheet = (items: PartyQuizItem[], over: Partial<PartyQuizSheet> = {}): PartyQuizSheet => ({
  party: 'Fine Gael', election: 'ge2024', documents: ['small-ge2024', 'big-ge2024'], model: 'deepseek-flash', promptVersion: 'v1', items, ...over,
});
const problems = (s: PartyQuizSheet, registry = REGISTRY) => validateSheet(s, registry);

describe('validateSheet', () => {
  it('passes a sheet inside every cap', () => {
    expect(problems(sheet([
      item(1),
      item(2, { quotes: [quote(words(50, 2)), quote(words(10, 22))] }),
      item(3, { status: 'abstained', answerIndex: null, abstainReason: 'contradictory', quotes: [quote(words(6, 3)), quote(words(6, 33))] }),
      item(4, { status: 'abstained', answerIndex: null, abstainReason: 'silent', quotes: [] }),
      item(5, { reviewerEdited: true, reviewNote: 'Page 12 is clearer.' }),
    ]))).toEqual([]);
  });

  it('allows at most 2 quotes per item', () => {
    expect(problems(sheet([item(1, { quotes: [quote(words(6, 1)), quote(words(6, 2)), quote(words(6, 3))] })]))).toEqual(['Q1: 3 quotes, at most 2']);
  });

  it('allows at most 50 words per quote', () => {
    expect(problems(sheet([item(1, { quotes: [quote(words(51))] })]))).toEqual(['Q1: a quote of 51 words, at most 50']);
  });

  it('needs a quote for an answer', () => {
    expect(problems(sheet([item(1, { quotes: [] })]))).toEqual(['Q1: answered without a quote']);
  });

  it('keeps quotes on an abstention only when it is contradictory', () => {
    const silent = item(1, { status: 'abstained', answerIndex: null, abstainReason: 'silent' });
    expect(problems(sheet([silent]))).toEqual(['Q1: a silent abstention carries quotes; only a contradictory one may']);
  });

  it('caps the words quoted from one document at 5% of it, and never above 3,000', () => {
    const small = [1, 2, 3].map((id) => item(id, { quotes: [quote(words(20, id)), quote(words(20, id + 10))] }));
    expect(problems(sheet(small))).toEqual(['small-ge2024: 120 words quoted, at most 100']);
    const big = Array.from({ length: 31 }, (_, i) => item(i + 1, { quotes: [quote(words(50, i), 'big-ge2024'), quote(words(50, i + 100), 'big-ge2024')] }));
    expect(problems(sheet(big))).toEqual(['big-ge2024: 3100 words quoted, at most 3000']);
  });

  it('allows one item per question', () => {
    expect(problems(sheet([item(1), item(1)]))).toEqual(['Q1: more than one item']);
  });

  it('needs a note on a reviewer edit', () => {
    expect(problems(sheet([item(1, { reviewerEdited: true })]))).toEqual(['Q1: a reviewer edit without a note']);
  });

  it('rejects a quote edited after it was verified', () => {
    const edited = { ...quote(words(8)), text: `${words(7)} changed` };
    expect(problems(sheet([item(1, { quotes: [edited] })]))).toEqual(['Q1: a quote does not match its quoteSha (edited after it was verified?)']);
  });

  it('checks the party label against the tds.party labels by partyKey', () => {
    const party = (name: string) => [doc('small-ge2024', name, 2_000)];
    const one = (name: string) => sheet([item(1)], { party: name, documents: ['small-ge2024'] });
    expect(problems(one('100% RDR'), party('100% RDR'))).toEqual([]);
    expect(problems(one('100% Redress'), party('100% Redress'))).toEqual(['party "100% Redress" is not a tds.party label']);
  });

  it('needs every document registered for the party, with a word count and a licence check', () => {
    const unchecked = [{ ...REGISTRY[0]!, licenceChecked: false }, REGISTRY[1]!];
    expect(problems(sheet([item(1)]), unchecked)).toEqual(['small-ge2024: no licence check or word count in the registry']);
    expect(problems(sheet([item(1)], { documents: ['small-ge2024', 'other-ge2024'] }))).toEqual(['other-ge2024: not in the registry for Fine Gael ge2024']);
    expect(problems(sheet([item(1, { quotes: [quote(words(8), 'other-ge2024')] })], { documents: ['small-ge2024'] }))).toEqual([
      'Q1: quotes other-ge2024, which the sheet does not list',
    ]);
  });
});

describe('renderSheetSource', () => {
  it('round-trips: the generated TypeScript evaluates to the same sheet', () => {
    const original = sheet([
      item(1, { quotes: [{ ...quote('Fáilte — “curly” quotes’ and a \\ backslash'), pageCorrected: true, pageLabel: 'iv' }] }),
      item(2, { status: 'abstained', answerIndex: null, abstainReason: 'low_confidence', tentativeAnswerIndex: 3, quotes: [], review: 'approved', stale: true }),
    ]);
    const source = renderSheetSource(original);
    expect(source.startsWith('// Generated')).toBe(true);
    expect(source).toContain('edit fields only; comments are not kept');
    const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
    const module = { exports: {} as { sheet?: PartyQuizSheet } };
    new Function('module', 'exports', code)(module, module.exports);
    expect(module.exports.sheet).toStrictEqual(original);
  });
});

describe('renderIndexSource', () => {
  it('is an empty list with no sheet files', () => {
    expect(renderIndexSource([])).toContain('export const SHEETS: PartyQuizSheet[] = [];');
  });

  it('imports every sheet file, sorted, into SHEETS', () => {
    const source = renderIndexSource(['ge2024/sinnfein', 'ge2024/finegael']);
    expect(source).toContain("import { sheet as ge2024_finegael } from './ge2024/finegael';\nimport { sheet as ge2024_sinnfein } from './ge2024/sinnfein';");
    expect(source).toContain('export const SHEETS: PartyQuizSheet[] = [ge2024_finegael, ge2024_sinnfein];');
  });

  it('names a sheet file by election and partyKey', () => {
    expect(sheetFile(sheet([], { party: 'People Before Profit–Solidarity' }))).toBe('ge2024/peoplebeforeprofitsolidarity');
  });
});

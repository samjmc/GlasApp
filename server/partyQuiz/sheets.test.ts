import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PartyQuizSheet } from '@shared/partyQuiz';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { quoteSha } from './normalise';
import { isCurrent } from './position';
import { REGISTRY, type ManifestoDocument } from './registry';
import { renderIndexSource, sheetFile, validateSheet } from './sheet';
import { SHEETS } from './sheets';

const DIR = path.join(__dirname, 'sheets');

/** Sheet files as `sheetFile` names them: `<election>/<name>`, no extension. */
function sheetFiles(): string[] {
  return fs
    .readdirSync(DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => fs.readdirSync(path.join(DIR, e.name)).filter((f) => f.endsWith('.ts')).map((f) => `${e.name}/${f.slice(0, -3)}`));
}

/** The checks every committed sheet must pass. */
function sheetProblems(sheet: PartyQuizSheet, registry: ManifestoDocument[], bank: QuizQuestion[]): string[] {
  const byId = new Map(bank.map((q) => [q.id, q] as const));
  const changed = sheet.items.filter((i) => !i.stale && !isCurrent(i, byId)).map((i) => `Q${i.questionId}`);
  const stale = changed.length
    ? [`${sheetFile(sheet)}: ${changed.join(', ')} changed in the bank; run \`npm run party-quiz -- check --mark-stale\``]
    : [];
  return [...validateSheet(sheet, registry), ...stale];
}

// Invented question, document and quote. The fingerprint is a literal, as a generated sheet's is.
const FIXTURE_BANK: QuizQuestion[] = [{
  id: 1, dimension: 'environmental', text: 'Should every town get a river warden?',
  answers: [
    { value: -2, text: 'Yes, paid by the state', description: 'Wardens in every town.' },
    { value: -1, text: 'Yes, where councils ask', description: 'Local choice.' },
    { value: 1, text: 'Only on the worst rivers', description: 'Target the damage.' },
    { value: 2, text: 'No, leave it to landowners', description: 'Private care.' },
  ],
}];
const FIXTURE_REGISTRY: ManifestoDocument[] = [{
  slug: 'fixture-ge2024', party: 'Green Party', election: 'ge2024', title: 'Fixture', url: 'https://example.ie/fixture.pdf',
  mirrorUrl: null, format: 'pdf', sha256: 'b'.repeat(64), wordCount: 20_000, retrieved: '2026-09-25', licenceChecked: true,
}];
const QUOTE = 'Every town in the country will have a paid river warden by the end of the term.';
const FIXTURE: PartyQuizSheet = {
  party: 'Green Party', election: 'ge2024', documents: ['fixture-ge2024'], model: 'deepseek-flash', promptVersion: 'v1',
  items: [{
    questionId: 1, fingerprint: 'a3e461f9', status: 'answered', answerIndex: 0, abstainReason: null,
    quotes: [{ document: 'fixture-ge2024', page: 3, pageLabel: '3', text: QUOTE, quoteSha: quoteSha(QUOTE) }],
    rationale: 'Promises a paid warden in every town.', modelConfidence: 0.9, review: 'approved',
  }],
};

describe('the committed answer sheets', () => {
  it('are exactly the sheet files: the index is regenerated from them and names each by party and election', () => {
    const files = sheetFiles();
    const index = fs.readFileSync(path.join(DIR, 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
    expect(index).toBe(renderIndexSource(files));
    expect(SHEETS).toHaveLength(files.length);
    expect(SHEETS.map(sheetFile)).toEqual([...files].sort());
  });

  it('each pass every cap and are current or marked stale', () => {
    for (const sheet of SHEETS) expect(sheetProblems(sheet, REGISTRY, QUIZ_QUESTIONS), sheetFile(sheet)).toEqual([]);
  });

  it('run the same checks on a fixture sheet, so an empty SHEETS is not a vacuous pass', () => {
    expect(sheetProblems(FIXTURE, FIXTURE_REGISTRY, FIXTURE_BANK)).toEqual([]);
  });

  it('fail an item whose question was edited, until it is marked stale', () => {
    const edited = structuredClone(FIXTURE_BANK);
    edited[0]!.answers[1]!.text = 'Yes, where councils vote for it';
    expect(sheetProblems(FIXTURE, FIXTURE_REGISTRY, edited)).toEqual([
      'ge2024/green: Q1 changed in the bank; run `npm run party-quiz -- check --mark-stale`',
    ]);
    const marked = structuredClone(FIXTURE);
    marked.items[0]!.stale = true;
    expect(sheetProblems(marked, FIXTURE_REGISTRY, edited)).toEqual([]);
  });
});

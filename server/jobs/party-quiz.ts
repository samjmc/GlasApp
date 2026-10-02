/**
 * Parties take the quiz from their manifestos. Gates and workflow: docs/architecture/party-quiz.md
 *
 *   npm run party-quiz -- ingest  --doc <slug> --file <path> [--retrieved YYYY-MM-DD] [--replace]
 *   npm run party-quiz -- answer  --party <label> [--questions 1,5] [--missing] [--force]
 *                                 [--dry-run] [--yes] [--shuffle-check] [--control]
 *   npm run party-quiz -- review  --party <label>
 *   npm run party-quiz -- approve --party <label> (--questions 1,5 | --all-pending)
 *   npm run party-quiz -- edit    --party <label> --question N --answer K --quote-page P --quote "..." --note "..."
 *   npm run party-quiz -- check   [--mark-stale] [--quotes]
 *   npm run party-quiz -- report  [--compare ches.csv]
 *
 * --store <dir> overrides the local text store (default ~/.glas/party-quiz; never inside the repo).
 * `answer` spends only with --yes, after printing its estimate.
 */
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import type { PartyQuizSheet } from '@shared/partyQuiz';
import { QUIZ_QUESTIONS } from '@shared/quiz';
import { runAnswer } from '../partyQuiz/answer';
import { extractDocument, likelyImagePages, type StoredPage } from '../partyQuiz/extract';
import { isCurrent } from '../partyQuiz/position';
import { REGISTRY } from '../partyQuiz/registry';
import { parseChesCsv, partyReport } from '../partyQuiz/report';
import { approve, editItem, markStale, recheckQuotes, reviewTable } from '../partyQuiz/review';
import { validateSheet } from '../partyQuiz/sheet';
import { readAllSheets, readSheet, writeSheet } from '../partyQuiz/sheetFiles';
import { TextStore, sha256Of } from '../partyQuiz/store';

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    doc: { type: 'string' },
    file: { type: 'string' },
    retrieved: { type: 'string' },
    replace: { type: 'boolean' },
    store: { type: 'string' },
    party: { type: 'string' },
    questions: { type: 'string' },
    missing: { type: 'boolean' },
    force: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    yes: { type: 'boolean' },
    'shuffle-check': { type: 'boolean' },
    control: { type: 'boolean' },
    'all-pending': { type: 'boolean' },
    question: { type: 'string' },
    answer: { type: 'string' },
    'quote-page': { type: 'string' },
    quote: { type: 'string' },
    note: { type: 'string' },
    'mark-stale': { type: 'boolean' },
    quotes: { type: 'boolean' },
    compare: { type: 'string' },
  },
});

function required(name: keyof typeof values): string {
  const value = values[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`--${name} is required`);
  return value;
}

function int(name: keyof typeof values): number {
  const n = Number(required(name));
  if (!Number.isInteger(n)) throw new Error(`--${name} needs an integer`);
  return n;
}

function ids(value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  const list = value.split(',').map((s) => Number(s.trim()));
  if (list.some((n) => !Number.isInteger(n))) throw new Error('--questions needs ids like 1,5,27');
  return list;
}

function sheetOf(party: string): PartyQuizSheet {
  const sheet = readSheet(party, 'ge2024');
  if (!sheet) throw new Error(`${party} has no ge2024 sheet yet; run answer first`);
  return sheet;
}

/** The stored pages of a sheet's documents: by the registry sha256, else by slug. */
function storedPages(sheet: PartyQuizSheet, store: TextStore): Map<string, StoredPage[]> {
  const pages = new Map<string, StoredPage[]>();
  for (const slug of sheet.documents) {
    const sha = REGISTRY.find((d) => d.slug === slug)?.sha256;
    const doc = sha ? store.read(sha) : store.find(slug);
    if (doc) pages.set(slug, doc.pages);
  }
  return pages;
}

async function ingest(): Promise<void> {
  const slug = required('doc');
  const doc = REGISTRY.find((d) => d.slug === slug);
  if (!doc) throw new Error(`No registry entry "${slug}". Known: ${REGISTRY.map((d) => d.slug).join(', ')}`);
  const retrieved = values.retrieved ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retrieved)) throw new Error('--retrieved needs a date: YYYY-MM-DD');
  const bytes = new Uint8Array(fs.readFileSync(required('file')));
  const store = new TextStore(values.store);
  const sha256 = sha256Of(bytes);
  if (doc.sha256 && doc.sha256 !== sha256) console.warn(`Warning: registry.ts has sha256 ${doc.sha256} for ${slug}; this file is different.`);

  store.replaced(slug, sha256, values.replace);
  const already = store.read(sha256);
  const { status, document } = already
    ? { status: 'unchanged' as const, document: already }
    : store.save({ slug, format: doc.format, bytes, ...(await extractDocument(doc.format, bytes)) }, { replace: values.replace });
  const images = likelyImagePages(document.pages);
  console.log(`${status}: ${slug} in ${store.dir}`);
  console.log(`  ${document.pageCount} page(s), ${document.wordCount} words, extracted with ${document.extractor}`);
  if (images.length) console.log(`  likely image pages (under 50 characters, no OCR): ${images.join(', ')}`);
  console.log(`Registry values for ${slug}, committed in the sheet PR:`);
  console.log(`  sha256: '${sha256}', wordCount: ${document.wordCount}, retrieved: '${retrieved}',`);
  console.log('  licenceChecked: true only after checking the site for a text-and-data-mining opt-out and accepting the quote caps.');
}

function check(): number {
  const store = values.quotes ? new TextStore(values.store) : null;
  const bank = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q] as const));
  let problems = 0;
  const sheets = readAllSheets();
  for (let sheet of sheets) {
    const before = JSON.stringify(sheet);
    const found: string[] = [];
    if (values['mark-stale']) {
      const marked = markStale(sheet);
      sheet = marked.sheet;
      if (marked.changed.length) console.log(`${sheet.party}: marked stale ${marked.changed.map((id) => `Q${id}`).join(', ')}; run answer --missing`);
    }
    if (store) {
      const rechecked = recheckQuotes(sheet, storedPages(sheet, store));
      sheet = rechecked.sheet;
      found.push(...rechecked.problems);
    }
    if (JSON.stringify(sheet) !== before) console.log(`Wrote ${writeSheet(sheet)}`);
    found.push(...validateSheet(sheet));
    const changed = sheet.items.filter((i) => !i.stale && !isCurrent(i, bank)).map((i) => `Q${i.questionId}`);
    if (changed.length) found.push(`${changed.join(', ')} changed in the bank; run \`npm run party-quiz -- check --mark-stale\``);
    for (const p of found) console.log(`${sheet.party}: ${p}`);
    problems += found.length;
  }
  console.log(`${sheets.length} sheet(s), ${problems} problem(s).`);
  return problems ? 1 : 0;
}

async function report(): Promise<void> {
  // The database is needed here only: the stored party rows, read-only.
  const repo = await import('../ideology/repository');
  const { shutdown } = await import('../db');
  try {
    const rows = (await repo.listProfiles('party')).map((p) => ({ party: p.subjectId, vector: repo.vectorOf(p) }));
    const ches = values.compare ? parseChesCsv(fs.readFileSync(values.compare, 'utf8')) : undefined;
    process.stdout.write(partyReport({ sheets: readAllSheets(), bank: QUIZ_QUESTIONS, rows, ches }));
  } finally {
    await shutdown();
  }
}

async function main(): Promise<number> {
  const [command] = positionals;
  switch (command) {
    case 'ingest':
      await ingest();
      return 0;
    case 'answer': {
      const summary = await runAnswer(
        {
          party: required('party'), questions: ids(values.questions), missing: values.missing, force: values.force,
          dryRun: values['dry-run'], yes: values.yes, shuffleCheck: values['shuffle-check'], control: values.control,
        },
        { store: new TextStore(values.store) },
      );
      return summary.failures.length ? 1 : 0;
    }
    case 'review':
      process.stdout.write(reviewTable(sheetOf(required('party'))));
      return 0;
    case 'approve': {
      const questions = values['all-pending'] ? 'all-pending' : ids(required('questions'))!;
      const sheet = approve(sheetOf(required('party')), questions);
      console.log(`Wrote ${writeSheet(sheet)}: ${sheet.items.filter((i) => i.review === 'approved').length} of ${sheet.items.length} approved.`);
      return 0;
    }
    case 'edit': {
      const sheet = sheetOf(required('party'));
      const edited = editItem(
        sheet,
        { question: int('question'), answer: int('answer'), quotePage: int('quote-page'), quote: required('quote'), note: required('note') },
        storedPages(sheet, new TextStore(values.store)),
      );
      console.log(`Wrote ${writeSheet(edited)}: Q${values.question} edited and approved.`);
      return 0;
    }
    case 'check':
      return check();
    case 'report':
      await report();
      return 0;
    default:
      throw new Error('Usage: npm run party-quiz -- <ingest|answer|review|approve|edit|check|report> [options]; see server/jobs/party-quiz.ts');
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

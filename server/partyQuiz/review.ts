/**
 * Reviewing a sheet before its PR is merged: the Markdown table for the PR body, and the
 * reviewer's operations (approve, edit, mark stale, re-check quotes). Pure: the job reads and
 * writes the files.
 */
import type { PartyQuizItem, PartyQuizQuote, PartyQuizSheet } from '@shared/partyQuiz';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { questionFingerprint } from '../quiz/fingerprint';
import type { StoredPage } from './extract';
import { findQuote, quoteSha } from './normalise';
import { isCurrent } from './position';
import { MAX_RATIONALE_WORDS } from './prompt';
import { REGISTRY, type ManifestoDocument } from './registry';

/** A link to the quoted page: `#page=` for a PDF, a text fragment of the first 6 words for HTML. */
export function citationHref(doc: ManifestoDocument, quote: PartyQuizQuote): string | null {
  if (!doc.url) return null;
  if (doc.format === 'pdf') return `${doc.url}#page=${quote.page}`;
  return `${doc.url}#:~:text=${encodeURIComponent(quote.text.trim().split(/\s+/).slice(0, 6).join(' '))}`;
}

const cell = (s: string) => s.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();

export function reviewTable(sheet: PartyQuizSheet, registry: ManifestoDocument[] = REGISTRY, bank: QuizQuestion[] = QUIZ_QUESTIONS): string {
  const byId = new Map(bank.map((q) => [q.id, q] as const));
  const docs = new Map(registry.map((d) => [d.slug, d] as const));
  const answerText = (q: QuizQuestion | undefined, i: number) => `${i}: ${q?.answers[i]?.text ?? '(not in the bank)'}`;
  const count = (f: (i: PartyQuizItem) => boolean) => sheet.items.filter(f).length;

  const rows = sheet.items.map((item) => {
    const q = byId.get(item.questionId);
    let answer = item.status === 'answered' ? answerText(q, item.answerIndex!) : `abstained (${item.abstainReason})`;
    if (item.tentativeAnswerIndex !== undefined) answer += `, leaned ${answerText(q, item.tentativeAnswerIndex)}`;
    const quotes = item.quotes.map((quote) => {
      const doc = docs.get(quote.document);
      const href = doc && citationHref(doc, quote);
      const page = `p. ${quote.pageLabel ?? quote.page}${sheet.documents.length > 1 ? `, ${quote.document}` : ''}`;
      return `"${quote.text}" (${href ? `[${page}](${href})` : page}${quote.pageCorrected ? ', page corrected' : ''})`;
    });
    const review = item.stale || !isCurrent(item, byId) ? 'stale' : item.review + (item.reviewerEdited ? ' (edited)' : '');
    return [String(item.questionId), q?.text ?? '(not in the bank)', answer, quotes.join('<br>'), item.rationale, item.modelConfidence.toFixed(2), review];
  });

  return [
    `${sheet.party} (${sheet.election}), model ${sheet.model}, prompt ${sheet.promptVersion}: ${sheet.items.length} items: ` +
      `${count((i) => i.status === 'answered')} answered, ${count((i) => i.status === 'abstained')} abstained; ` +
      `${count((i) => i.review === 'pending')} pending, ${count((i) => i.review === 'approved')} approved, ${count((i) => i.review === 'rejected')} rejected.`,
    '',
    '| Q | Question | Answer | Quotes | Rationale | Confidence | Review |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
    '',
  ].join('\n');
}

function withItems(sheet: PartyQuizSheet, update: (item: PartyQuizItem) => PartyQuizItem): PartyQuizSheet {
  return { ...sheet, items: sheet.items.map(update) };
}

/** Approve the listed questions, or every pending item. Abstentions are approved too. */
export function approve(sheet: PartyQuizSheet, questions: number[] | 'all-pending'): PartyQuizSheet {
  if (questions !== 'all-pending') {
    const missing = questions.filter((id) => !sheet.items.some((i) => i.questionId === id));
    if (missing.length) throw new Error(`No item in ${sheet.party}'s sheet for ${missing.map((id) => `Q${id}`).join(', ')}`);
  }
  const chosen = (i: PartyQuizItem) => (questions === 'all-pending' ? i.review === 'pending' : questions.includes(i.questionId));
  return withItems(sheet, (i) => (chosen(i) ? { ...i, review: 'approved' } : i));
}

/** Where the quote is among the sheet's stored documents; throws unless it is found in exactly one. */
function locate(sheet: PartyQuizSheet, docs: Map<string, StoredPage[]>, text: string, page: number): PartyQuizQuote {
  const found: PartyQuizQuote[] = [];
  const misses: string[] = [];
  for (const slug of sheet.documents) {
    const pages = docs.get(slug);
    if (!pages) {
      misses.push(`${slug} is not in the text store`);
      continue;
    }
    const match = findQuote(pages, text, page);
    if (!match.found) misses.push(`${slug}: ${match.reason}`);
    else found.push({
      document: slug, page: match.page, pageLabel: pages.find((p) => p.ordinal === match.page)?.label ?? null,
      text: text.trim(), quoteSha: quoteSha(text), ...(match.pageCorrected ? { pageCorrected: true } : {}),
    });
  }
  const exact = found.filter((q) => !q.pageCorrected);
  const pick = exact.length === 1 ? exact : found;
  if (pick.length === 1) return pick[0]!;
  throw new Error(found.length ? `the quote is in more than one document: ${found.map((q) => q.document).join(', ')}` : `the quote was not found on page ${page} (${misses.join('; ')})`);
}

export interface ReviewerEdit {
  question: number;
  answer: number;
  quotePage: number;
  quote: string;
  note: string;
}

/**
 * The reviewer's own answer: replaces the model's answer and quotes with a quote verified
 * against the store. It is the reviewer's decision, so the item is approved.
 */
export function editItem(sheet: PartyQuizSheet, edit: ReviewerEdit, docs: Map<string, StoredPage[]>, bank: QuizQuestion[] = QUIZ_QUESTIONS): PartyQuizSheet {
  const question = bank.find((q) => q.id === edit.question);
  if (!question) throw new Error(`Q${edit.question} is not in the bank`);
  if (!Number.isInteger(edit.answer) || edit.answer < 0 || edit.answer >= question.answers.length) {
    throw new Error(`--answer must be from 0 to ${question.answers.length - 1}`);
  }
  if (!edit.note.trim()) throw new Error('--note is required: say why the answer changed');
  const quote = locate(sheet, docs, edit.quote, edit.quotePage);
  const previous = sheet.items.find((i) => i.questionId === edit.question);
  const note = edit.note.trim();
  const words = note.split(/\s+/);
  const item: PartyQuizItem = {
    questionId: edit.question,
    fingerprint: questionFingerprint(question),
    status: 'answered',
    answerIndex: edit.answer,
    abstainReason: null,
    quotes: [quote],
    rationale: words.length <= MAX_RATIONALE_WORDS ? note : `${words.slice(0, MAX_RATIONALE_WORDS).join(' ')}…`,
    modelConfidence: previous?.modelConfidence ?? 0,
    review: 'approved',
    reviewerEdited: true,
    reviewNote: note,
  };
  const items = previous ? sheet.items.map((i) => (i === previous ? item : i)) : [...sheet.items, item].sort((a, b) => a.questionId - b.questionId);
  return { ...sheet, items };
}

/** `stale` on every item whose question changed or left the bank; cleared where it matches again. */
export function markStale(sheet: PartyQuizSheet, bank: QuizQuestion[] = QUIZ_QUESTIONS): { sheet: PartyQuizSheet; changed: number[] } {
  const byId = new Map(bank.map((q) => [q.id, q] as const));
  const changed: number[] = [];
  const next = withItems(sheet, (item) => {
    const { stale, ...rest } = item;
    if (isCurrent(item, byId)) return rest;
    if (!stale) changed.push(item.questionId);
    return { ...rest, stale: true };
  });
  return { sheet: next, changed };
}

/** Re-verifies every quote against the store, re-stamping its page, label and quoteSha. */
export function recheckQuotes(sheet: PartyQuizSheet, docs: Map<string, StoredPage[]>): { sheet: PartyQuizSheet; problems: string[] } {
  const problems: string[] = [];
  const next = withItems(sheet, (item) => ({
    ...item,
    quotes: item.quotes.map((quote, n) => {
      const pages = docs.get(quote.document);
      if (!pages) {
        problems.push(`Q${item.questionId}: ${quote.document} is not in the text store`);
        return quote;
      }
      const match = findQuote(pages, quote.text, quote.page);
      if (!match.found) {
        problems.push(`Q${item.questionId}: quote ${n + 1} was not found on page ${quote.page} of ${quote.document} (${match.reason})`);
        return quote;
      }
      const { pageCorrected, ...rest } = quote;
      return {
        ...rest, page: match.page, pageLabel: pages.find((p) => p.ordinal === match.page)?.label ?? null, quoteSha: quoteSha(quote.text),
        ...(match.pageCorrected || pageCorrected ? { pageCorrected: true } : {}),
      };
    }),
  }));
  return { sheet: next, problems };
}

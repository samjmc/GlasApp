/**
 * The party answers the API serves (GET /api/ideology/party/:name/answers and /party-answers):
 * only approved items for the question as the bank has it now, each quote linked to its page.
 * Sheets and the registry are compiled into the build, so there is nothing to cache.
 */
import type { ManifestoCitation, PartyAnswers, PartyQuizAnswer } from '@shared/ideologyMatch';
import type { PartyQuizItem, PartyQuizQuote, PartyQuizSheet } from '@shared/partyQuiz';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { partyKey } from '../ideology/partyBaselines';
import { isCurrent, manifestoPosition } from './position';
import { REGISTRY, documentsFor, type ManifestoDocument } from './registry';
import { SHEETS } from './sheets';

/** Most question ids one /party-answers request may ask for. */
export const MAX_ANSWER_QUESTIONS = 60;

/** Words of a quote an HTML link scrolls to. */
const FRAGMENT_WORDS = 6;

function href(doc: ManifestoDocument | undefined, quote: PartyQuizQuote): string | null {
  if (!doc?.url) return null;
  if (doc.format === 'pdf') return `${doc.url}#page=${quote.page}`;
  const words = quote.text.split('…')[0]!.trim().split(/\s+/).slice(0, FRAGMENT_WORDS).join(' ');
  // A text fragment reads "-" as syntax; encodeURIComponent leaves it alone.
  return `${doc.url}#:~:text=${encodeURIComponent(words).replace(/-/g, '%2D')}`;
}

function citation(quote: PartyQuizQuote, registry: ManifestoDocument[]): ManifestoCitation {
  const doc = registry.find((d) => d.slug === quote.document);
  return {
    document: quote.document,
    title: doc?.title ?? quote.document,
    url: doc?.url ?? null,
    pdfPage: doc?.format === 'pdf' ? quote.page : null,
    page: quote.pageLabel ?? String(quote.page),
    href: href(doc, quote),
    quote: quote.text,
  };
}

/** null unless approved, current and, when answered, an answer the question has. */
function answerOf(party: string, item: PartyQuizItem, bank: Map<number, QuizQuestion>, registry: ManifestoDocument[]): PartyQuizAnswer | null {
  if (item.review !== 'approved' || item.stale || !isCurrent(item, bank)) return null;
  const answer = item.status === 'answered' && item.answerIndex !== null ? bank.get(item.questionId)!.answers[item.answerIndex] : undefined;
  if (item.status === 'answered' && !answer) return null;
  return {
    party,
    questionId: item.questionId,
    answered: !!answer,
    answerIndex: answer ? item.answerIndex : null,
    value: answer?.value ?? null,
    rationale: item.rationale,
    abstainReason: item.abstainReason,
    modelConfidence: item.modelConfidence,
    citations: item.quotes.map((q) => citation(q, registry)),
  };
}

function served(sheets: PartyQuizSheet[], registry: ManifestoDocument[], bank: QuizQuestion[]): PartyQuizAnswer[] {
  const byId = new Map(bank.map((q) => [q.id, q] as const));
  return sheets.flatMap((s) =>
    s.items.map((item) => answerOf(s.party, item, byId, registry)).filter((a): a is PartyQuizAnswer => a !== null),
  );
}

/** The answers payload of a party that has a position but no registered manifesto. */
export function noPartyAnswers(party: string): PartyAnswers {
  return { party, election: 'ge2024', documents: [], position: null, pendingCount: 0, answers: [] };
}

/** A party's documents, manifesto position and served answers; null with neither a document nor a sheet. */
export function partyAnswers(
  party: string,
  sheets: PartyQuizSheet[] = SHEETS,
  registry: ManifestoDocument[] = REGISTRY,
  bank: QuizQuestion[] = QUIZ_QUESTIONS,
): PartyAnswers | null {
  const own = sheets.filter((s) => partyKey(s.party) === partyKey(party));
  const docs = documentsFor(party, registry);
  const first = own[0] ?? docs[0];
  if (!first) return null;
  return {
    party: first.party,
    election: first.election,
    documents: docs.map(({ slug, title, url }) => ({ slug, title, url })),
    position: manifestoPosition(party, sheets, bank),
    pendingCount: own.flatMap((s) => s.items).filter((i) => i.review === 'pending').length,
    answers: served(own, registry, bank),
  };
}

/** Every party's served answers to each question asked; a question with none maps to []. */
export function answersForQuestions(
  questionIds: number[],
  sheets: PartyQuizSheet[] = SHEETS,
  registry: ManifestoDocument[] = REGISTRY,
  bank: QuizQuestion[] = QUIZ_QUESTIONS,
): Record<number, PartyQuizAnswer[]> {
  if (questionIds.length > MAX_ANSWER_QUESTIONS) throw new RangeError(`At most ${MAX_ANSWER_QUESTIONS} questions`);
  const all = served(sheets, registry, bank);
  return Object.fromEntries(questionIds.map((id) => [id, all.filter((a) => a.questionId === id)]));
}

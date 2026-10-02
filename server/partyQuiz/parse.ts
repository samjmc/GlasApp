/**
 * The model's reply → a sheet item, or the problem with it. Pure, except that `answerQuestion`
 * calls the `ask` it is given.
 *
 * Every quote must be found in the stored text (normalise.findQuote). A reply that fails is
 * retried once with the failure named; a quote that still cannot be found becomes an
 * `unverified_quote` abstention, and any other problem is a failure the caller reports, so
 * nothing unverified reaches a sheet.
 */
import type { PartyQuizItem, PartyQuizQuote } from '@shared/partyQuiz';
import type { QuizQuestion } from '@shared/quiz';
import { questionFingerprint } from '../quiz/fingerprint';
import type { StoredPage } from './extract';
import { findQuote, quoteSha } from './normalise';
import { MAX_RATIONALE_WORDS, bankIndex, type ChatMessage } from './prompt';
import { MAX_QUOTES_PER_ITEM } from './sheet';

/** Below this the answer is kept only as `tentativeAnswerIndex`, for review. */
export const MIN_CONFIDENCE = 0.5;
const MODEL_ABSTAIN_REASONS = ['silent', 'no_preference', 'contradictory'] as const;

export interface AnswerContext {
  question: QuizQuestion;
  /** The pages of each document the model read, by slug. */
  docs: Map<string, StoredPage[]>;
  /** --shuffle-check: order[shown] = bank index. */
  order?: number[];
}

/** `quote` is true when the only problem is a quote that could not be found. */
export type ParsedReply = { item: PartyQuizItem } | { problem: string; quote: boolean };

const problem = (text: string, quote = false): ParsedReply => ({ problem: text, quote });

function capWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= max ? words.join(' ') : `${words.slice(0, max).join(' ')}…`;
}

function verify(raw: unknown[], ctx: AnswerContext): PartyQuizQuote[] | string {
  const quotes: PartyQuizQuote[] = [];
  for (const [i, entry] of raw.slice(0, MAX_QUOTES_PER_ITEM).entries()) {
    const { document, page, text } = (entry ?? {}) as Record<string, unknown>;
    if (typeof document !== 'string' || !Number.isInteger(page) || typeof text !== 'string') {
      return `quote ${i + 1} needs a document slug, an integer page and the text`;
    }
    const pages = ctx.docs.get(document);
    if (!pages) return `quote ${i + 1} names document "${document}", which is not one of ${Array.from(ctx.docs.keys()).join(', ')}`;
    const match = findQuote(pages, text, page as number);
    if (!match.found) return `quote ${i + 1} was not found on page ${page} of ${document} (${match.reason}); copy it exactly`;
    const label = pages.find((p) => p.ordinal === match.page)?.label ?? null;
    quotes.push({
      document, page: match.page, pageLabel: label, text: text.trim(), quoteSha: quoteSha(text),
      ...(match.pageCorrected ? { pageCorrected: true } : {}),
    });
  }
  return quotes;
}

export function parseReply(reply: string, ctx: AnswerContext): ParsedReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return problem('the reply is not JSON');
  }
  if (!parsed || typeof parsed !== 'object') return problem('the reply is not a JSON object');
  const { quotes = [], rationale, status, answerIndex, abstainReason, confidence } = parsed as Record<string, unknown>;
  if (status !== 'answered' && status !== 'abstained') return problem('status must be "answered" or "abstained"');
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return problem('confidence must be a number from 0 to 1');
  if (!Array.isArray(quotes)) return problem('quotes must be a list');

  const { question } = ctx;
  const base = {
    questionId: question.id,
    fingerprint: questionFingerprint(question),
    rationale: typeof rationale === 'string' ? capWords(rationale, MAX_RATIONALE_WORDS) : '',
    modelConfidence: Math.min(1, Math.max(0, confidence)),
    review: 'pending' as const,
  };

  if (status === 'abstained') {
    const reason = MODEL_ABSTAIN_REASONS.find((r) => r === abstainReason);
    if (!reason) return problem(`abstainReason must be one of ${MODEL_ABSTAIN_REASONS.join(', ')}`);
    // Only a contradictory abstention carries quotes (the sheet caps).
    const kept = reason === 'contradictory' ? verify(quotes, ctx) : [];
    if (typeof kept === 'string') return problem(kept, true);
    return { item: { ...base, status, answerIndex: null, abstainReason: reason, quotes: kept } };
  }

  const n = question.answers.length;
  if (!Number.isInteger(answerIndex) || (answerIndex as number) < 0 || (answerIndex as number) >= n) {
    return problem(`answerIndex must be an answer number from 0 to ${n - 1}`);
  }
  if (quotes.length === 0) return problem('an answered question needs at least one quote');
  const verified = verify(quotes, ctx);
  if (typeof verified === 'string') return problem(verified, true);
  const index = bankIndex(ctx.order, answerIndex as number);
  if (base.modelConfidence < MIN_CONFIDENCE) {
    return { item: { ...base, status: 'abstained', answerIndex: null, abstainReason: 'low_confidence', tentativeAnswerIndex: index, quotes: [] } };
  }
  return { item: { ...base, status, answerIndex: index, abstainReason: null, quotes: verified } };
}

export type Ask = (messages: ChatMessage[]) => Promise<string>;

export async function answerQuestion(
  ask: Ask,
  messages: ChatMessage[],
  ctx: AnswerContext,
): Promise<{ item: PartyQuizItem } | { failure: string }> {
  const first = await ask(messages);
  const parsed = parseReply(first, ctx);
  if ('item' in parsed) return parsed;

  const retry: ChatMessage[] = [
    ...messages,
    { role: 'assistant', content: first },
    { role: 'user', content: `Your reply could not be used: ${parsed.problem}. Reply again with JSON only, following the rules.` },
  ];
  const second = parseReply(await ask(retry), ctx);
  if ('item' in second) return second;
  if (!second.quote) return { failure: second.problem };
  return {
    item: {
      questionId: ctx.question.id, fingerprint: questionFingerprint(ctx.question), status: 'abstained', answerIndex: null,
      abstainReason: 'unverified_quote', quotes: [], rationale: capWords(second.problem, MAX_RATIONALE_WORDS), modelConfidence: 0, review: 'pending',
    },
  };
}

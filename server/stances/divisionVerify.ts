/**
 * Deterministic checks on the two model replies about a Dáil division (01c §3.2–3.3). Pure.
 *
 * A quote proves the text is real, not that the reading is right: whether "Tá means X" is right
 * and whether the option is a fair reading of X are for the human gates. What code can check is
 * that the quote is copied from the ONE block it names, that the block fits the kind of question,
 * and that the match names only a question and keys that were sent.
 */
import type { DivisionKind, DivisionRejectReason } from '@shared/divisionMeaning';
import { POLICY_DOMAINS, type PolicyDomain } from '../constants/policyTopics';
import type { BlockKind, MatchReply, MeaningReply, ProposalBlock } from './divisionPrompt';
import { QUOTE_MAX_WORDS, QUOTE_MIN_WORDS } from './extract';
import { normalise } from './verify';

/** Below this, the model is too unsure what Tá meant. */
export const MIN_MEANING_CONFIDENCE = 0.6;
/** Below this, the match is not a match. */
export const MIN_MATCH_CONFIDENCE = 0.7;
export const MAX_DOMAINS = 2;

/** Which block a question of each kind may be read from. A kind not listed is never quoted. */
export const ALLOWED_BLOCKS: Partial<Record<DivisionKind, BlockKind[]>> = {
  amendment: ['A'],
  words_stand: ['M'],
  motion: ['M'],
  bill_stage: ['B', 'M'],
  other: ['Q', 'B', 'M'],
};
/** One text per question: more than one allowed block and the vote cannot be tied to one. */
const ONE_TEXT: DivisionKind[] = ['amendment', 'words_stand', 'motion'];
const ELLIPSIS = /\.\.\.|…/;

export type MeaningCheck =
  | { status: 'procedural' }
  | { status: 'rejected'; reason: DivisionRejectReason }
  | { status: 'ok'; block: string; quote: string; domains: PolicyDomain[] };

const rejected = (reason: DivisionRejectReason): MeaningCheck => ({ status: 'rejected', reason });

/**
 * The meaning reply against exactly the blocks that were sent. In order, the first failure
 * wins: procedural; "as amended" or unclear (nothing on record says what Tá means there);
 * no known domain; a quote of the wrong length; a block not sent or not allowed; more than one
 * allowed block; the quote not in its block; low confidence.
 */
export function verifyMeaning(reply: MeaningReply, blocks: ProposalBlock[]): MeaningCheck {
  if (reply.procedural || reply.divisionKind === 'procedural' || reply.divisionKind === 'confidence') return { status: 'procedural' };
  if (reply.divisionKind === 'as_amended' || reply.divisionKind === 'unclear') return rejected('ambiguous');

  const domains = reply.policyDomains.filter((d): d is PolicyDomain => Object.prototype.hasOwnProperty.call(POLICY_DOMAINS, d));
  const kept = Array.from(new Set(domains)).slice(0, MAX_DOMAINS);
  if (kept.length === 0) return rejected('invalid');

  const quote = normalise(reply.quote).text.replace(/^['" ]+|['" ]+$/g, '');
  const words = quote ? quote.split(' ').length : 0;
  if (ELLIPSIS.test(reply.quote) || words < QUOTE_MIN_WORDS || words > QUOTE_MAX_WORDS) return rejected('invalid');

  const allowed = ALLOWED_BLOCKS[reply.divisionKind] ?? [];
  const named = blocks.find((b) => b.label === reply.quoteBlock);
  if (!named || !allowed.includes(named.kind)) return rejected('invalid');
  if (ONE_TEXT.includes(reply.divisionKind) && blocks.filter((b) => allowed.includes(b.kind)).length > 1) return rejected('ambiguous');

  const text = normalise(named.text);
  const at = text.text.indexOf(quote);
  if (at === -1) return rejected('quote_not_found');
  if (reply.confidence < MIN_MEANING_CONFIDENCE) return rejected('unsure');
  const start = text.offsets[at]!;
  const end = text.offsets[at + quote.length - 1]! + 1;
  return { status: 'ok', block: named.label, quote: named.text.slice(start, end), domains: kept };
}

export type MatchCheck =
  | { status: 'no_match' }
  | { status: 'rejected'; reason: 'invalid' }
  | { status: 'matched'; questionId: number; taOption: string; nilOption: string | null; confidence: number; reason: string };

/**
 * The match reply against the candidates that were SENT. Any wrong id or key rejects the whole
 * match (a wrong key would publish a TD's vote as something it was not); no question, or low
 * confidence, is no match.
 */
export function verifyMatch(reply: MatchReply, candidates: Array<{ id: number; options: Array<{ key: string }> }>): MatchCheck {
  if (reply.questionId === null) return { status: 'no_match' };
  const question = candidates.find((c) => c.id === reply.questionId);
  if (!question) return { status: 'rejected', reason: 'invalid' };
  const isKey = (key: string | null) => key !== null && question.options.some((o) => o.key === key);
  if (!isKey(reply.taOption)) return { status: 'rejected', reason: 'invalid' };
  if (reply.nilOption !== null && (!isKey(reply.nilOption) || reply.nilOption === reply.taOption)) return { status: 'rejected', reason: 'invalid' };
  if (reply.confidence < MIN_MATCH_CONFIDENCE) return { status: 'no_match' };
  return { status: 'matched', questionId: question.id, taOption: reply.taOption!, nilOption: reply.nilOption, confidence: reply.confidence, reason: reply.reason };
}

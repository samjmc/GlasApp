/**
 * Deterministic checks on the three model replies about a Dáil division (01c §3.2–3.3). Pure.
 *
 * A quote proves the text is real, not that the reading is right: whether "Tá means X" is right
 * and whether the option is a fair reading of X are for the human gates. What code can check is
 * that the quote is copied from the ONE block it names, that the block fits the kind of question,
 * that the match names only a question and keys that were sent, that its answer names no figure the
 * proposal does not, and that every claim in it has supporting words really in the proposal.
 */
import type { DivisionKind, DivisionRejectReason } from '@shared/divisionMeaning';
import { POLICY_DOMAINS, type PolicyDomain } from '../constants/policyTopics';
import type { BlockKind, FitClaim, MatchReply, MeaningReply, ProposalBlock } from './divisionPrompt';
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
/** The other kinds read from more than one kind of block (a bill's title and the motion to read it), but not from two of the same kind. */
const ONE_OF_EACH: DivisionKind[] = ['bill_stage', 'other'];
/** The question as recorded names an amendment ("Amendment put", "That amendment No. 4 be made"). */
const NAMES_AMENDMENT = /\bamendments?\b/i;
/** A reading that treats such a question as one of these is reading the wrong text: the Tá voters backed the amendment. */
const NOT_AN_AMENDMENT: DivisionKind[] = ['motion', 'bill_stage', 'other'];
const ELLIPSIS = /\.\.\.|…/;

export type MeaningCheck =
  | { status: 'procedural' }
  | { status: 'rejected'; reason: DivisionRejectReason }
  | { status: 'ok'; block: string; quote: string; domains: PolicyDomain[] };

const rejected = (reason: DivisionRejectReason): MeaningCheck => ({ status: 'rejected', reason });

/**
 * The meaning reply against exactly the blocks that were sent. In order, the first failure
 * wins: procedural; "as amended" or unclear (nothing on record says what Tá means there);
 * a blank `ta_means` (a matched reading must carry one); no known domain; a quote of the wrong length; a block not sent or not allowed; more than one
 * allowed block; the quote not in its block; low confidence.
 *
 * `blocks` are the blocks that were SENT (within the character budget); `every` are all of them. The
 * ambiguity checks count `every`: a second motion that did not fit the prompt is still a second
 * motion, and a reading that quoted the first would otherwise pass as the only one. The recorded
 * question also has the last word on one thing: when it names an amendment, the reading must be of
 * an amendment (or the words standing), not of a motion that the Tá voters did not vote for.
 */
export function verifyMeaning(reply: MeaningReply, blocks: ProposalBlock[], every: ProposalBlock[] = blocks): MeaningCheck {
  if (reply.procedural || reply.divisionKind === 'procedural' || reply.divisionKind === 'confidence') return { status: 'procedural' };
  if (reply.divisionKind === 'as_amended' || reply.divisionKind === 'unclear') return rejected('ambiguous');
  if (!reply.taMeans) return rejected('invalid');

  const domains = reply.policyDomains.filter((d): d is PolicyDomain => Object.prototype.hasOwnProperty.call(POLICY_DOMAINS, d));
  const kept = Array.from(new Set(domains)).slice(0, MAX_DOMAINS);
  if (kept.length === 0) return rejected('invalid');

  const quote = normalise(reply.quote).text.replace(/^['" ]+|['" ]+$/g, '');
  const words = quote ? quote.split(' ').length : 0;
  if (ELLIPSIS.test(reply.quote) || words < QUOTE_MIN_WORDS || words > QUOTE_MAX_WORDS) return rejected('invalid');

  const allowed = ALLOWED_BLOCKS[reply.divisionKind] ?? [];
  const named = blocks.find((b) => b.label === reply.quoteBlock);
  if (!named || !allowed.includes(named.kind)) return rejected('invalid');
  const recorded = every.find((b) => b.kind === 'Q')?.text ?? '';
  if (NAMES_AMENDMENT.test(recorded) && NOT_AN_AMENDMENT.includes(reply.divisionKind)) return rejected('ambiguous');
  if (ONE_TEXT.includes(reply.divisionKind) && every.filter((b) => allowed.includes(b.kind)).length > 1) return rejected('ambiguous');
  if (ONE_OF_EACH.includes(reply.divisionKind) && allowed.some((kind) => every.filter((b) => b.kind === kind).length > 1)) return rejected('ambiguous');

  const text = normalise(named.text);
  const at = text.text.indexOf(quote);
  if (at === -1) return rejected('quote_not_found');
  if (reply.confidence < MIN_MEANING_CONFIDENCE) return rejected('unsure');
  const start = text.offsets[at]!;
  const end = text.offsets[at + quote.length - 1]! + 1;
  return { status: 'ok', block: named.label, quote: named.text.slice(start, end), domains: kept };
}

/**
 * The numbers in a text, with thousands separators removed ("€50,000" → "50000", "5 per cent" →
 * "5"). A figure is the one thing a code check can compare exactly: an answer that names a figure
 * the vote does not name says more than the vote did.
 */
export function figuresIn(text: string): string[] {
  return (text.match(/\d[\d,.]*\d|\d/g) ?? []).map((n) => n.replace(/,/g, ''));
}

/** Below this many words a "supporting passage" proves nothing: "calls on the Government" is in nearly every motion. */
export const MIN_SUPPORT_WORDS = 5;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The claims of a matched answer against the proposal's text. A claim is stated only when the
 * words the model gave as support really are in the proposal (case, fadas, quote marks, spacing and
 * the punctuation around them aside; whole words only) and are long enough to mean something.
 * Returns the claims that are NOT stated: no support (`support: null`), support that is invented
 * or paraphrased, or too short.
 *
 * `proposal` is one text, or the texts of the allowed blocks: support has to be inside ONE of them.
 * Joined into one string, the end of one block and the start of the next read as one passage, and
 * words the model stitched across a block boundary would pass.
 *
 * What it cannot see: a claim the model left out of its list. That is the model's call to make.
 */
export function verifyFit(claims: FitClaim[], proposal: string | string[]): string[] {
  const texts = (Array.isArray(proposal) ? proposal : [proposal]).map((p) => normalise(p).text);
  return claims
    .filter((c) => {
      const support = c.support === null ? '' : normalise(c.support).text.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
      const words = support ? support.split(' ').length : 0;
      if (words < MIN_SUPPORT_WORDS) return true;
      const found = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(support)}(?:$|[^a-z0-9])`);
      return !texts.some((text) => found.test(text));
    })
    .map((c) => c.claim);
}

export type MatchCheck =
  | { status: 'no_match'; overstated?: string[] }
  | { status: 'rejected'; reason: 'invalid' }
  | { status: 'matched'; questionId: number; taOption: string; confidence: number; reason: string };

/**
 * The match reply against the candidates that were SENT. Any wrong id or key rejects the whole
 * match (a wrong key would publish a TD's vote as something it was not); no question, or low
 * confidence, is no match.
 *
 * Only the Tá answer is kept. A vote AGAINST a proposal does not state an answer: which one it
 * implies is an inference, and the words-as-support check cannot verify a negation, so a Níl
 * answer would be published on the model's word alone.
 *
 * `proposal` is the proposal's own text (the blocks this kind of question may be read from). The
 * Tá answer may not name a figure that is not in it (a vote to raise relief to €35,000 does not
 * state "raise it to €50,000"); that is no match, with the figures listed.
 *
 * Only the option's label is read for figures, not the question's stem: the labels carry the
 * specifics (that is how the €50,000 case showed up), and a stem often holds a number that is not the
 * answer's (a year) and would refuse good matches. A question whose stem names the figure and whose
 * options do not is a gap for the human check.
 */
export function verifyMatch(
  reply: MatchReply,
  candidates: Array<{ id: number; options: Array<{ key: string; label: string }> }>,
  proposal: string,
): MatchCheck {
  if (reply.questionId === null) return { status: 'no_match' };
  const question = candidates.find((c) => c.id === reply.questionId);
  if (!question) return { status: 'rejected', reason: 'invalid' };
  const isKey = (key: string | null) => key !== null && question.options.some((o) => o.key === key);
  if (!isKey(reply.taOption)) return { status: 'rejected', reason: 'invalid' };
  if (reply.confidence < MIN_MATCH_CONFIDENCE) return { status: 'no_match' };
  const stated = new Set(figuresIn(proposal));
  const overstated = figuresIn(question.options.find((o) => o.key === reply.taOption)?.label ?? '').filter((n) => !stated.has(n));
  if (overstated.length > 0) return { status: 'no_match', overstated };
  return { status: 'matched', questionId: question.id, taOption: reply.taOption!, confidence: reply.confidence, reason: reply.reason };
}

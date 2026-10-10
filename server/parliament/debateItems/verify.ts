/**
 * Step 2 of debate analysis, part 2: deterministic checks on what the model listed. Pure.
 *
 * 1. The speech is a labelled (extract) speech of this window, else `context_speech` or `invalid`.
 * 2. The quote is 3–40 words, with no ellipsis, else `invalid`; and it is in that speech after
 *    normalising both (fadas, quote marks, dashes, case, spaces), else `quote_not_found`.
 * 3. A response or concession points to an EARLIER speech in the window, by ANOTHER member, else
 *    `bad_target`. A response's target quote is kept when it is found in that speech (v3: it no
 *    longer rejects the response, since only the reply's own words are shown).
 * 4. A question's sentence ends with a question mark, else `not_a_question`; and names an office
 *    or someone who speaks in the window, else `unknown_addressee`.
 * 5. A commitment is made by someone in government office that day, else `not_office_holder`.
 * 6. The same kind and quote twice in one speech is `duplicate`.
 * 7. Claims past MAX_CLAIMS_PER_SPEECH in one speech are `over_limit` (the model does not always
 *    keep to it: 13 in one speech in the pilot).
 */
import type { CommitmentType, DebateClaimType, DebateItemKind } from '@shared/schema/parliament';
import { normalise } from '../../stances/verify';
import { MAX_CLAIMS_PER_SPEECH, QUOTE_MAX_WORDS, QUOTE_MIN_WORDS, type RawItem } from './prompt';
import { sentenceAround } from './replies';
import { isIrish, type DebateWindow, type LabelledSpeech } from './windows';

export const REJECT_REASONS = [
  'invalid',
  'context_speech',
  'quote_not_found',
  'bad_target',
  'not_a_question',
  'unknown_addressee',
  'not_office_holder',
  'duplicate',
  'over_limit',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];
export type Language = 'en' | 'ga';
export type Rejections = Record<RejectReason, Record<Language, number>>;

export interface VerifiedItem {
  speechId: string;
  memberCode: string;
  kind: DebateItemKind;
  claimType: DebateClaimType | null;
  /** The words as they appear in the speech. */
  quote: string;
  quoteStart: number;
  quoteEnd: number;
  targetSpeechId: string | null;
  targetQuote: string | null;
  addressee: string | null;
  due: string | null;
  commitmentType: CommitmentType | null;
}

/** member code → the periods they held cabinet or Minister of State office. */
export type GovernmentOffices = Map<string, Array<{ start: string; end: string | null }>>;

const ELLIPSIS = /\.\.\.|…/;
/**
 * Words a question can be put to that are offices, not people. Normalised (no fadas). Irish
 * included: "an tAire" normalises to "an taire", which the pilot first rejected.
 */
const OFFICE_WORDS = ['minister', 'taoiseach', 'tanaiste', 'government', 'ceann comhairle', 'aire', 'taire', 'rialtas'];

export function emptyRejections(): Rejections {
  const out = {} as Rejections;
  for (const reason of REJECT_REASONS) out[reason] = { en: 0, ga: 0 };
  return out;
}

/** Where `quote` sits in `text`, in the original string's offsets; null when it is not there. */
export function findQuote(text: string, quote: string): { start: number; end: number } | null {
  const n = normalise(text);
  const q = normalise(quote).text.replace(/^['" ]+|['" ]+$/g, '');
  if (!q) return null;
  const pos = n.text.indexOf(q);
  if (pos === -1) return null;
  return { start: n.offsets[pos]!, end: n.offsets[pos + q.length - 1]! + 1 };
}

const wordCount = (quote: string) => normalise(quote).text.split(' ').filter(Boolean).length;

/** The surname, normalised: the last word of a speaker's name ("Deputy Pa Daly" → "daly"). */
function surnameOf(speaker: string): string {
  const name = speaker.split(/[(,]/)[0]!.trim();
  const words = normalise(name).text.split(' ');
  return words[words.length - 1] ?? '';
}

function addresseeKnown(addressee: string, window: DebateWindow): boolean {
  const a = ` ${normalise(addressee).text} `;
  if (OFFICE_WORDS.some((w) => a.includes(` ${w}`))) return true;
  const surnames = [...window.context, ...window.speeches].map((s) => surnameOf(s.speaker)).filter((s) => s.length > 1);
  return surnames.some((s) => a.includes(` ${s} `) || a.includes(` ${s}'`));
}

function holdsOffice(offices: GovernmentOffices, memberCode: string, date: string): boolean {
  return (offices.get(memberCode) ?? []).some((o) => o.start <= date && (o.end === null || date <= o.end));
}

export function verifyItems(raw: RawItem[], window: DebateWindow, offices: GovernmentOffices): { accepted: VerifiedItem[]; rejected: Rejections } {
  const rejected = emptyRejections();
  const accepted: VerifiedItem[] = [];
  const byLabel = new Map<string, LabelledSpeech>([...window.context, ...window.speeches].map((s) => [s.label, s]));
  const extractable = new Set(window.speeches.map((s) => s.label));
  const seen = new Set<string>();
  const claimsIn = new Map<string, number>();

  for (const item of raw) {
    const speech = byLabel.get(item.speech);
    const language: Language = speech && isIrish(speech.text) ? 'ga' : 'en';
    const reject = (reason: RejectReason) => {
      rejected[reason][language]++;
    };
    if (!speech) {
      reject('invalid');
      continue;
    }
    if (!extractable.has(item.speech)) {
      reject('context_speech');
      continue;
    }
    const words = wordCount(item.quote);
    if (ELLIPSIS.test(item.quote) || words < QUOTE_MIN_WORDS || words > QUOTE_MAX_WORDS || (item.kind === 'specific_claim' && !item.claimType)) {
      reject('invalid');
      continue;
    }
    const at = findQuote(speech.text, item.quote);
    if (!at) {
      reject('quote_not_found');
      continue;
    }

    let target: LabelledSpeech | null = null;
    let targetQuote: string | null = null;
    if (item.kind === 'response' || item.kind === 'concession') {
      target = item.targetSpeech ? (byLabel.get(item.targetSpeech) ?? null) : null;
      if (!target || target.index >= speech.index || target.memberCode === speech.memberCode) {
        reject('bad_target');
        continue;
      }
      // v3: the passage pointed to is kept when it is found and dropped when not. It is never shown
      // (rules r2 show the reply's own words, which replies.ts checks name the target), so a
      // mis-copied passage no longer costs a real reply.
      if (item.kind === 'response') {
        const t = item.targetQuote ? findQuote(target.text, item.targetQuote) : null;
        targetQuote = t ? target.text.slice(t.start, t.end) : null;
      }
    }
    // The question mark ends the sentence, which often runs on past the quote.
    if (item.kind === 'question' && !sentenceAround(speech.text, at.start, at.end).includes('?')) {
      reject('not_a_question');
      continue;
    }
    if (item.kind === 'question' && (!item.addressee || !addresseeKnown(item.addressee, window))) {
      reject('unknown_addressee');
      continue;
    }
    if (item.kind === 'commitment' && !holdsOffice(offices, speech.memberCode, speech.date)) {
      reject('not_office_holder');
      continue;
    }
    const key = `${speech.id}\u0000${item.kind}\u0000${at.start}`;
    if (seen.has(key)) {
      reject('duplicate');
      continue;
    }
    seen.add(key);
    if (item.kind === 'specific_claim') {
      const n = (claimsIn.get(speech.id) ?? 0) + 1;
      claimsIn.set(speech.id, n);
      if (n > MAX_CLAIMS_PER_SPEECH) {
        reject('over_limit');
        continue;
      }
    }

    accepted.push({
      speechId: speech.id,
      memberCode: speech.memberCode,
      kind: item.kind,
      claimType: item.kind === 'specific_claim' ? item.claimType : null,
      quote: speech.text.slice(at.start, at.end),
      quoteStart: at.start,
      quoteEnd: at.end,
      targetSpeechId: target?.id ?? null,
      targetQuote,
      addressee: item.kind === 'question' ? item.addressee : null,
      due: item.kind === 'commitment' ? item.due : null,
      commitmentType: item.kind === 'commitment' ? (item.commitmentType ?? null) : null,
    });
  }
  return { accepted, rejected };
}

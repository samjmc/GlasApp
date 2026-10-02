/**
 * Step 2 of TD stances: deterministic checks on what the model extracted. Pure.
 *
 * 1. The quote is in the text that was sent (after normalising both), else `quote_not_found`.
 * 2. A `direct` quote needs an opening quote mark just before it, else it becomes `paraphrase`.
 * 3. The TD's surname, one of their offices, or "Taoiseach"/"Tánaiste" when they hold it, is
 *    within NEAR_CHARS of the quote, else `td_not_near`. Two TDs with the same surname can
 *    pass for each other; that is accepted, because the quote is always shown.
 * 4. An unknown td_id or domain, or a quote that breaks the prompt's rules, is `invalid`.
 */
import { POLICY_DOMAINS, type PolicyDomain } from '../constants/policyTopics';
import { QUOTE_MAX_WORDS, QUOTE_MIN_WORDS, type CandidateTd, type QuoteKind, type RawStance } from './extract';

export const NEAR_CHARS = 300;
/** How far before a direct quote its opening quote mark may sit (a space, say). */
export const OPENING_MARK_CHARS = 2;

export const REJECT_REASONS = ['invalid', 'quote_not_found', 'td_not_near', 'duplicate'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export interface VerifiedStance {
  tdId: number;
  policyDomain: PolicyDomain;
  /** The passage as it appears in the article, not as the model typed it. */
  quote: string;
  quoteKind: QuoteKind;
  /** Where the quote sits in the verified text. */
  start: number;
  end: number;
}

export interface VerifyResult {
  accepted: VerifiedStance[];
  rejected: Record<RejectReason, number>;
  /** How many `direct` stances were downgraded to `paraphrase`. */
  downgraded: number;
}

// NFKC leaves these alone, so they are mapped explicitly. Code points, because several of
// them are invisible or look identical to their straight form in an editor.
const STRAIGHTENED: Array<[string, number[]]> = [
  ["'", [0x2018, 0x2019, 0x201a, 0x201b, 0x2032, 0x0060, 0x00b4]],
  ['"', [0x201c, 0x201d, 0x201e, 0x201f, 0x2033, 0x00ab, 0x00bb]],
  ['-', [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212]],
];
const CHAR_MAP: Record<string, string> = {};
for (const [straight, codes] of STRAIGHTENED) for (const code of codes) CHAR_MAP[String.fromCharCode(code)] = straight;
/** The Combining Diacritical Marks block: what NFD splits a fada off into. */
const isCombiningMark = (code: number) => code >= 0x0300 && code <= 0x036f;
const WHITESPACE = /\s/;
const WORD_CHAR = /[a-z0-9]/;
const ELLIPSIS = /\.\.\.|…/;
const HEAD_OFFICES = ['taoiseach', 'tanaiste'];

export interface Normalised {
  text: string;
  /** For each character of `text`, its index in the original string. */
  offsets: number[];
}

/** Fadas stripped, lower case, curly quotes and dashes made straight, whitespace collapsed. */
export function normalise(original: string): Normalised {
  let text = '';
  const offsets: number[] = [];
  for (let i = 0; i < original.length; i++) {
    const ch = original[i]!;
    if (WHITESPACE.test(ch)) {
      if (text.length > 0 && text[text.length - 1] !== ' ') {
        text += ' ';
        offsets.push(i);
      }
      continue;
    }
    const mapped = Object.prototype.hasOwnProperty.call(CHAR_MAP, ch) ? CHAR_MAP[ch]! : ch.toLowerCase().normalize('NFD');
    for (let k = 0; k < mapped.length; k++) {
      if (isCombiningMark(mapped.charCodeAt(k))) continue;
      text += mapped[k];
      offsets.push(i);
    }
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    offsets.pop();
  }
  return { text, offsets };
}

const isWordChar = (ch: string | undefined) => ch !== undefined && WORD_CHAR.test(ch);

/** `needle` occurs in `hay[from, to)` as whole words. */
function hasWord(hay: string, needle: string, from: number, to: number): boolean {
  if (!needle) return false;
  let at = hay.indexOf(needle, from);
  while (at !== -1 && at + needle.length <= to) {
    if (!isWordChar(hay[at - 1]) && !isWordChar(hay[at + needle.length])) return true;
    at = hay.indexOf(needle, at + 1);
  }
  return false;
}

/** The normalised names a TD can be referred to by near their quote. */
export function namesFor(td: CandidateTd): string[] {
  const tokens = normalise(td.name).text.split(' ');
  const names = [tokens[tokens.length - 1]!];
  for (const office of td.offices) {
    const title = normalise(office).text.replace(/^an /, '');
    if (title) names.push(title);
    // "Tánaiste and Minister for …" is still "the Tánaiste" in the press.
    const first = title.split(' ')[0];
    if (first && title !== first && HEAD_OFFICES.indexOf(first) !== -1) names.push(first);
  }
  return names;
}

/** An opening quote mark in the OPENING_MARK_CHARS before `pos`; a `'` must not be an apostrophe. */
function hasOpeningMark(text: string, pos: number): boolean {
  for (let i = Math.max(0, pos - OPENING_MARK_CHARS); i < pos; i++) {
    if (text[i] === '"') return true;
    if (text[i] === "'" && !isWordChar(text[i - 1])) return true;
  }
  return false;
}

/** The normalised range whose original offsets fall within NEAR_CHARS of [origStart, origEnd). */
function nearRange(n: Normalised, origStart: number, origEnd: number): [number, number] {
  let from = 0;
  while (from < n.offsets.length && n.offsets[from]! < origStart - NEAR_CHARS) from++;
  let to = n.offsets.length;
  while (to > from && n.offsets[to - 1]! >= origEnd + NEAR_CHARS) to--;
  return [from, to];
}

function emptyCounts(): Record<RejectReason, number> {
  const counts = {} as Record<RejectReason, number>;
  for (const reason of REJECT_REASONS) counts[reason] = 0;
  return counts;
}

/**
 * Check every extracted stance against `text`, which must be exactly the text the model was
 * sent (see `extractionText`). At most one stance per TD is accepted: the first that passes.
 */
export function verifyStances(text: string, candidates: CandidateTd[], stances: RawStance[]): VerifyResult {
  const n = normalise(text);
  const rejected = emptyCounts();
  const accepted: VerifiedStance[] = [];
  let downgraded = 0;

  for (const stance of stances) {
    const td = candidates.find((c) => c.id === stance.tdId);
    const quote = normalise(stance.quote).text.replace(/^['" ]+|['" ]+$/g, '');
    const words = quote ? quote.split(' ').length : 0;
    if (
      !td ||
      !Object.prototype.hasOwnProperty.call(POLICY_DOMAINS, stance.policyDomain) ||
      ELLIPSIS.test(stance.quote) ||
      words < QUOTE_MIN_WORDS ||
      words > QUOTE_MAX_WORDS
    ) {
      rejected.invalid++;
      continue;
    }

    const names = namesFor(td);
    let found = false;
    let match: { pos: number; direct: boolean } | null = null;
    for (let pos = n.text.indexOf(quote); pos !== -1; pos = n.text.indexOf(quote, pos + 1)) {
      found = true;
      const origStart = n.offsets[pos]!;
      const origEnd = n.offsets[pos + quote.length - 1]! + 1;
      const [from, to] = nearRange(n, origStart, origEnd);
      if (!names.some((name) => hasWord(n.text, name, from, to))) continue;
      const direct = hasOpeningMark(n.text, pos);
      if (!match || (direct && !match.direct)) match = { pos, direct };
      if (direct) break;
    }
    if (!found) {
      rejected.quote_not_found++;
      continue;
    }
    if (!match) {
      rejected.td_not_near++;
      continue;
    }
    if (accepted.some((a) => a.tdId === td.id)) {
      rejected.duplicate++;
      continue;
    }

    const kind: QuoteKind = stance.quoteKind === 'direct' && !match.direct ? 'paraphrase' : stance.quoteKind;
    if (kind !== stance.quoteKind) downgraded++;
    const start = n.offsets[match.pos]!;
    const end = n.offsets[match.pos + quote.length - 1]! + 1;
    accepted.push({
      tdId: td.id,
      policyDomain: stance.policyDomain as PolicyDomain,
      quote: text.slice(start, end),
      quoteKind: kind,
      start,
      end,
    });
  }

  return { accepted, rejected, downgraded };
}

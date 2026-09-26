/**
 * Checking that a quote is really in a document. Pure.
 *
 * Text from a PDF differs from the same text typed by a model: ligatures, curly quotes, soft
 * hyphens, words split at a line break. `skeleton` keeps only letters and digits, so all of
 * those compare equal, and a quote is matched as a substring of its page's skeleton.
 */
import { createHash } from 'node:crypto';

export const MIN_QUOTE_WORDS = 6;
export const MAX_QUOTE_WORDS = 50;

/** The citation unit: one page of a stored document. */
export interface PageText {
  ordinal: number;
  text: string;
}

export type QuoteMatch =
  | { found: true; page: number; pageCorrected: boolean }
  | { found: false; reason: 'too_short' | 'too_long' | 'not_found' | 'several_pages' };

// Constructed, not literals: tsconfig has no `target` yet, and tsc rejects a /u literal below ES6.
const NOT_LETTER_OR_DIGIT = new RegExp('[^\\p{L}\\p{N}]', 'gu');
const LETTER_OR_DIGIT = new RegExp('[\\p{L}\\p{N}]', 'u');

export function skeleton(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(NOT_LETTER_OR_DIGIT, '');
}

/** Words that carry a letter or digit, so a lone "…" or "-" is not a word. */
export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => LETTER_OR_DIGIT.test(w)).length;
}

/** First 16 hex of sha256(skeleton(text)). */
export function quoteSha(text: string): string {
  return createHash('sha256').update(skeleton(text)).digest('hex').slice(0, 16);
}

/**
 * Where `quote` is, trusting the cited page first. A page is searched joined to the next one,
 * for a quote that runs over a page break, but the quote must START on it. A quote with "…"
 * is split into fragments that must appear in order. If the quote is not on the cited page
 * but is on exactly one other, that page is returned; on several, it is not found.
 */
export function findQuote(pages: PageText[], quote: string, citedPage: number): QuoteMatch {
  const words = wordCount(quote);
  if (words < MIN_QUOTE_WORDS) return { found: false, reason: 'too_short' };
  if (words > MAX_QUOTE_WORDS) return { found: false, reason: 'too_long' };

  const fragments = quote.split(/…|\.\.\./).map(skeleton).filter(Boolean);
  const skeletons = pages.map((p) => skeleton(p.text));
  const startsOn = (i: number): boolean => {
    const window = skeletons[i]! + (skeletons[i + 1] ?? '');
    let from = window.indexOf(fragments[0]!);
    if (from < 0 || from >= skeletons[i]!.length) return false;
    for (const fragment of fragments) {
      const at = window.indexOf(fragment, from);
      if (at < 0) return false;
      from = at + fragment.length;
    }
    return true;
  };

  const cited = pages.findIndex((p) => p.ordinal === citedPage);
  if (cited >= 0 && startsOn(cited)) return { found: true, page: citedPage, pageCorrected: false };
  const others = pages.filter((_, i) => i !== cited && startsOn(i));
  if (others.length === 1) return { found: true, page: others[0]!.ordinal, pageCorrected: true };
  return { found: false, reason: others.length > 1 ? 'several_pages' : 'not_found' };
}

/**
 * Drops running headers and footers: a line (digits masked) on more than half the pages and
 * on at least 4 of them. Blank lines are kept.
 */
export function stripRepeatedLines(pages: string[]): string[] {
  const key = (line: string) => line.trim().replace(/\d+/g, '#');
  const seenOn = new Map<string, number>();
  for (const page of pages) {
    for (const k of Array.from(new Set(page.split('\n').map(key)))) if (k) seenOn.set(k, (seenOn.get(k) ?? 0) + 1);
  }
  const repeated = (k: string) => {
    const n = seenOn.get(k) ?? 0;
    return n > pages.length / 2 && n >= 4;
  };
  return pages.map((page) => page.split('\n').filter((line) => !repeated(key(line))).join('\n'));
}

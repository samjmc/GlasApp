/**
 * From one Wikipedia revision's HTML to the plain text a TD's background may be copied from.
 * Pure: no network. Everything shown on the page is a substring of `text` (or of `lead`).
 *
 * Rules enforced HERE, in code, not only in the model's prompt (docs/plans/td-history.md):
 * - Sections about controversies, criticism, personal or legal matters are cut out before
 *   anything else sees the text, so nothing from them can be chosen or verified.
 * - A sentence or passage with an allegation word (SENSITIVE) is never shown.
 */
import * as cheerio from 'cheerio';

/** How much text one model call sees, so each call has a fixed cost. */
export const SOURCE_MAX_CHARS = 12_000;
/** Lead sentences in the summary. */
export const SUMMARY_SENTENCES = 2;

/**
 * A section (or subsection) whose heading matches is cut, with every subsection under it.
 * Non-prose sections are cut too: they hold no sentences worth quoting.
 */
export const EXCLUDED_HEADING =
  /controvers|critic|personal life|private life|family|legal|scandal|allegation|investigation|conviction|court|lawsuit|references|external links|see also|notes|further reading|bibliography|sources|citations|footnotes/i;

/**
 * Words that mark an allegation, a legal matter or criticism. Matching text is never shown,
 * even when it is a fact in the source: this section is a neutral career background, and an
 * allegation about a living person needs more context than a quote can carry.
 */
export const SENSITIVE =
  /\b(alleg\w*|accus\w*|scandal\w*|convict\w*|arrest\w*|charged|guilty|fraud\w*|corrupt\w*|brib\w*|investigat\w*|tribunal\w*|court\w*|sued|lawsuit\w*|controvers\w*|critici[sz]\w*|condemn\w*|apologi[sz]\w*|harass\w*|assault\w*|misconduct|prosecut\w*|crimes?|criminal\w*|police|garda\w*|inquir(y|ies)|probe[sd]?)\b/i;

export interface SourceText {
  /** The lead paragraphs, before the first heading. */
  lead: string;
  /** Lead plus the kept sections' paragraphs, capped at SOURCE_MAX_CHARS. Verify checks against this. */
  text: string;
  /** Headings that were cut, for the run log. */
  cut: string[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function htmlToSource(html: string): SourceText {
  const $ = cheerio.load(html);
  const output = $('.mw-parser-output').first();
  const root = output.length ? output : $('body');
  const lead: string[] = [];
  const body: string[] = [];
  const cut: string[] = [];
  let seenHeading = false;
  /** The h2 currently cut, so its h3/h4 children are cut with it. */
  let cutLevel: number | null = null;

  root.children().each((_, el) => {
    const $el = $(el);
    const heading = $el.is('div.mw-heading') ? $el.find('h2,h3,h4,h5,h6').first() : $el.is('h2,h3,h4,h5,h6') ? $el : null;
    if (heading && heading.length) {
      seenHeading = true;
      const level = Number(heading.prop('tagName')?.slice(1) ?? 2);
      const title = clean(heading.text());
      if (cutLevel !== null && level > cutLevel) return;
      cutLevel = null;
      if (EXCLUDED_HEADING.test(title)) {
        cutLevel = level;
        cut.push(title);
      }
      return;
    }
    if (cutLevel !== null || !$el.is('p')) return;
    $el.find('sup, style, .mw-ref, .mw-editsection, [style*="display:none"]').remove();
    const paragraph = clean($el.text());
    if (!paragraph) return;
    (seenHeading ? body : lead).push(paragraph);
  });

  let text = '';
  for (const paragraph of [...lead, ...body]) {
    const next = text ? `${text}\n\n${paragraph}` : paragraph;
    if (next.length > SOURCE_MAX_CHARS) break;
    text = next;
  }
  return { lead: lead.join('\n\n'), text, cut };
}

/** Abbreviations whose full stop does not end a sentence. Lower case, without the stop. */
const ABBREVIATIONS = new Set(['st', 'dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'no', 'co', 'fr', 'rev', 'prof', 'hon', 'gen', 'lt', 'col', 'sgt', 'approx', 'vs', 'etc', 'e.g', 'i.e', 'inc', 'ltd']);

/** Split prose into sentences. An initial ("W. T. Cosgrave") or an abbreviation does not end one. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const boundary = /[.!?]["')\]]*\s+(?=["'(‘“]?[A-Z0-9])/g;
  for (let m = boundary.exec(text); m; m = boundary.exec(text)) {
    const stop = m.index;
    const word = /([A-Za-z.]+)$/.exec(text.slice(start, stop))?.[1] ?? '';
    if (text[stop] === '.' && (/^[A-Z]$/.test(word) || ABBREVIATIONS.has(word.toLowerCase()))) continue;
    out.push(text.slice(start, m.index + m[0].trimEnd().length).trim());
    start = m.index + m[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/**
 * The summary: the lead's first SUMMARY_SENTENCES sentences, word for word, stopping at the
 * first SENSITIVE one. Null when even the first sentence is sensitive or there is no lead:
 * the TD then gets no background at all (fail closed).
 */
export function leadSummary(lead: string): string | null {
  const firstParagraph = lead.split('\n\n')[0] ?? '';
  const kept: string[] = [];
  for (const sentence of sentences(firstParagraph)) {
    if (kept.length === SUMMARY_SENTENCES || SENSITIVE.test(sentence)) break;
    kept.push(sentence);
  }
  return kept.length ? kept.join(' ') : null;
}

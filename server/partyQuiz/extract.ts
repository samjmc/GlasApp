/**
 * A downloaded manifesto → its pages, the citation unit. Imported only by the party-quiz job.
 *
 * PDF: one page per pdf.js page, with its printed label. HTML: one "page" per h1–h3 section,
 * the heading as its first line. Running headers and footers are then dropped (normalise.ts).
 * A page with almost no text is probably an image; OCR is out of scope, so it is only flagged.
 */
import { load } from 'cheerio';
import { extractText, getDocumentProxy } from 'unpdf';
import type { ManifestoDocument } from './registry';
import { stripRepeatedLines } from './normalise';

export interface StoredPage {
  ordinal: number;
  /** The page number printed on a PDF page; null for HTML. */
  label: string | null;
  /** The h1–h3 heading an HTML section starts with; null for PDF. */
  heading: string | null;
  text: string;
}

export const EXTRACTORS: Record<ManifestoDocument['format'], string> = { pdf: 'unpdf@1.7.0', html: 'cheerio' };
/** A page with fewer characters than this is flagged as a likely image. */
export const MIN_PAGE_CHARS = 50;

export async function extractPdf(bytes: Uint8Array): Promise<StoredPage[]> {
  // A copy: pdf.js takes ownership of the buffer it is given.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const labels = await pdf.getPageLabels();
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((t, i) => ({ ordinal: i + 1, label: labels?.[i] ?? null, heading: null, text: t }));
  } finally {
    await pdf.destroy();
  }
}

const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg']);
const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer',
  'form', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'td', 'th', 'tr', 'ul',
]);
const HEADING = /^h[1-3]$/;

export function extractHtml(html: string): StoredPage[] {
  const $ = load(html);
  const sections: Array<{ heading: string | null; parts: string[] }> = [{ heading: null, parts: [] }];
  const body = $('body').contents().toArray();
  const walk = (nodes: typeof body) => {
    for (const node of nodes) {
      const parts = sections[sections.length - 1]!.parts;
      if (node.nodeType === 3) parts.push(node.data.replace(/\s+/g, ' '));
      if (node.nodeType !== 1 || SKIP.has(node.name)) continue;
      if (HEADING.test(node.name)) {
        const heading = $(node).text().replace(/\s+/g, ' ').trim();
        sections.push({ heading, parts: [heading, '\n'] });
        continue;
      }
      const block = BLOCK.has(node.name);
      if (block) parts.push('\n');
      walk($(node).contents().toArray());
      if (block) parts.push('\n');
    }
  };
  walk(body);

  return sections
    .map(({ heading, parts }) => ({ heading, text: parts.join('').split('\n').map((l) => l.trim()).filter(Boolean).join('\n') }))
    .filter((s) => s.text)
    .map((s, i) => ({ ordinal: i + 1, label: null, heading: s.heading, text: s.text }));
}

export function likelyImagePages(pages: StoredPage[]): number[] {
  return pages.filter((p) => p.text.trim().length < MIN_PAGE_CHARS).map((p) => p.ordinal);
}

export async function extractDocument(
  format: ManifestoDocument['format'],
  bytes: Uint8Array,
): Promise<{ extractor: string; pages: StoredPage[] }> {
  const pages = format === 'pdf' ? await extractPdf(bytes) : extractHtml(new TextDecoder().decode(bytes));
  const texts = stripRepeatedLines(pages.map((p) => p.text));
  return { extractor: EXTRACTORS[format], pages: pages.map((p, i) => ({ ...p, text: texts[i]! })) };
}

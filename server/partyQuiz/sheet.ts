/**
 * Party answer sheets: the caps a sheet must meet before it is committed, and the generated
 * source files it is committed as. Sheets and their PRs are public, so every quote is short
 * and capped; the full manifesto text is never committed.
 */
import { PARTY_NAMES } from '@/lib/parties';
import type { PartyQuizSheet } from '@shared/partyQuiz';
import { partyKey } from '../ideology/partyBaselines';
import { MAX_QUOTE_WORDS, quoteSha, wordCount } from './normalise';
import { REGISTRY, documentsFor, type ManifestoDocument } from './registry';

export const MAX_QUOTES_PER_ITEM = 2;
/** Words quoted from one document: at most min(3,000, 5% of the document). */
export const MAX_QUOTED_WORDS_PER_DOCUMENT = 3_000;
export const MAX_QUOTED_SHARE_OF_DOCUMENT = 0.05;

const PARTY_KEYS = new Set(PARTY_NAMES.map(partyKey));

/**
 * Everything wrong with a sheet; empty when it may be committed. A sheet may list only its own
 * party's documents and there is one sheet per party and election (sheets.test.ts), so the
 * per-document word cap counted here is the cap across all sheets.
 */
export function validateSheet(sheet: PartyQuizSheet, registry: ManifestoDocument[] = REGISTRY): string[] {
  const problems: string[] = [];
  if (!PARTY_KEYS.has(partyKey(sheet.party))) problems.push(`party "${sheet.party}" is not a tds.party label`);

  const docs = new Map(
    documentsFor(sheet.party, registry)
      .filter((d) => d.election === sheet.election)
      .map((d) => [d.slug, d] as const),
  );
  for (const slug of sheet.documents) {
    const doc = docs.get(slug);
    if (!doc) problems.push(`${slug}: not in the registry for ${sheet.party} ${sheet.election}`);
    else if (!doc.licenceChecked || !doc.wordCount) problems.push(`${slug}: no licence check or word count in the registry`);
  }

  const seen = new Set<number>();
  const quoted = new Map<string, number>();
  for (const item of sheet.items) {
    const at = `Q${item.questionId}`;
    if (seen.has(item.questionId)) problems.push(`${at}: more than one item`);
    seen.add(item.questionId);
    if (item.quotes.length > MAX_QUOTES_PER_ITEM) problems.push(`${at}: ${item.quotes.length} quotes, at most ${MAX_QUOTES_PER_ITEM}`);
    if (item.status === 'answered' && item.quotes.length === 0) problems.push(`${at}: answered without a quote`);
    if (item.status === 'abstained' && item.abstainReason !== 'contradictory' && item.quotes.length > 0) {
      problems.push(`${at}: a ${item.abstainReason} abstention carries quotes; only a contradictory one may`);
    }
    if (item.reviewerEdited && !item.reviewNote?.trim()) problems.push(`${at}: a reviewer edit without a note`);
    for (const quote of item.quotes) {
      const n = wordCount(quote.text);
      if (n > MAX_QUOTE_WORDS) problems.push(`${at}: a quote of ${n} words, at most ${MAX_QUOTE_WORDS}`);
      if (quote.quoteSha !== quoteSha(quote.text)) problems.push(`${at}: a quote does not match its quoteSha (edited after it was verified?)`);
      if (!sheet.documents.includes(quote.document)) problems.push(`${at}: quotes ${quote.document}, which the sheet does not list`);
      quoted.set(quote.document, (quoted.get(quote.document) ?? 0) + n);
    }
  }

  for (const [slug, n] of Array.from(quoted)) {
    const total = docs.get(slug)?.wordCount;
    if (!total) continue; // reported above
    const cap = Math.min(MAX_QUOTED_WORDS_PER_DOCUMENT, Math.floor(MAX_QUOTED_SHARE_OF_DOCUMENT * total));
    if (n > cap) problems.push(`${slug}: ${n} words quoted, at most ${cap}`);
  }
  return problems;
}

/**
 * Bring a sheet inside its per-document quote cap. One quote supports an answer, so while a
 * document is over its cap the second quote of an item is dropped, lowest model confidence first
 * (then the higher question id). An item's only quote is never dropped. Returns the fitted sheet
 * and how many quotes went; a sheet already inside its caps is returned unchanged.
 */
export function fitToQuoteCap(sheet: PartyQuizSheet, registry: ManifestoDocument[] = REGISTRY): { sheet: PartyQuizSheet; dropped: number } {
  const docs = new Map(documentsFor(sheet.party, registry).filter((d) => d.election === sheet.election).map((d) => [d.slug, d] as const));
  const items = sheet.items.map((item) => ({ ...item, quotes: [...item.quotes] }));
  const quotedWords = (slug: string) =>
    items.reduce((sum, i) => sum + i.quotes.filter((q) => q.document === slug).reduce((s, q) => s + wordCount(q.text), 0), 0);
  let dropped = 0;
  for (const slug of sheet.documents) {
    const total = docs.get(slug)?.wordCount;
    if (!total) continue;
    const cap = Math.min(MAX_QUOTED_WORDS_PER_DOCUMENT, Math.floor(MAX_QUOTED_SHARE_OF_DOCUMENT * total));
    const droppable = items
      .filter((i) => i.quotes.length > 1 && i.quotes[i.quotes.length - 1]!.document === slug)
      .sort((a, b) => a.modelConfidence - b.modelConfidence || b.questionId - a.questionId);
    for (const item of droppable) {
      if (quotedWords(slug) <= cap) break;
      item.quotes.pop();
      dropped += 1;
    }
  }
  return { sheet: dropped === 0 ? sheet : { ...sheet, items }, dropped };
}

/** Where a sheet lives under server/partyQuiz/sheets, without the extension. */
export function sheetFile(sheet: Pick<PartyQuizSheet, 'party' | 'election'>): string {
  return `${sheet.election}/${partyKey(sheet.party)}`;
}

export function renderSheetSource(sheet: PartyQuizSheet): string {
  return [
    '// Generated by `npm run party-quiz`; edit fields only; comments are not kept.',
    "import type { PartyQuizSheet } from '@shared/partyQuiz';",
    '',
    `export const sheet: PartyQuizSheet = ${JSON.stringify(sheet, null, 2)};`,
    '',
  ].join('\n');
}

/** sheets/index.ts for the given sheet files (as `sheetFile` names them). */
export function renderIndexSource(files: string[]): string {
  const sorted = [...files].sort();
  const name = (file: string) => file.replace(/[^A-Za-z0-9]/g, '_');
  return [
    '// Generated by `npm run party-quiz` from the sheet files; do not edit.',
    "import type { PartyQuizSheet } from '@shared/partyQuiz';",
    ...sorted.map((file) => `import { sheet as ${name(file)} } from './${file}';`),
    '',
    `export const SHEETS: PartyQuizSheet[] = [${sorted.map(name).join(', ')}];`,
    '',
  ].join('\n');
}

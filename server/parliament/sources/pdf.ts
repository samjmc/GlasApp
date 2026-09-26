/**
 * PDF → lines of text, per page. The Oireachtas publishes the interests register and the
 * allowance payments only as PDFs; their plain text loses the table layout, so lines are
 * rebuilt here from the positioned text items that pdf.js reports.
 */
import { getDocumentProxy } from 'unpdf';

/** A pdf.js text item, reduced to what line-building reads. */
export interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Items within this share of the text height of each other, vertically, are one line. */
const SAME_LINE = 0.5;
/** A gap wider than this share of the text height is a column break, joined with a tab. */
const COLUMN_GAP = 1.5;
/** A gap narrower than this share of the text height is inside a word, joined with nothing. */
const WORD_GAP = 0.1;

/** pdf.js VerbosityLevel.ERRORS: its font warnings ("TT: undefined function") are noise here. */
const ERRORS_ONLY = 0;

/** Every page of the PDF as lines of text, top to bottom. */
export async function pdfLines(bytes: Uint8Array): Promise<string[][]> {
  const pdf = await getDocumentProxy(bytes, { verbosity: ERRORS_ONLY });
  try {
    const pages: string[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      const items: PositionedText[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height });
      }
      pages.push(groupLines(items));
    }
    return pages;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/**
 * Pure: positioned items → lines in reading order. Items are grouped by baseline, sorted by
 * x, and joined with a tab across a wide gap and a single space otherwise.
 */
export function groupLines(items: PositionedText[]): string[] {
  // Whitespace items only fill gaps, which are measured from the geometry instead.
  const visible = items.filter((i) => i.str.trim() !== '');
  // PDF y runs up the page, so the top line has the largest y.
  visible.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PositionedText[][] = [];
  for (const item of visible) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - item.y) <= SAME_LINE * Math.max(line[0].height, item.height)) line.push(item);
    else lines.push([item]);
  }

  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    let text = line[0].str;
    for (let i = 1; i < line.length; i++) {
      const prev = line[i - 1];
      const gap = line[i].x - (prev.x + prev.width);
      const size = Math.max(prev.height, line[i].height);
      const sep = gap > COLUMN_GAP * size ? '\t' : gap > WORD_GAP * size ? ' ' : '';
      text += sep + line[i].str;
    }
    // Items can carry their own leading or trailing spaces; keep one between words.
    return text.split('\t').map((cell) => cell.replace(/ +/g, ' ').trim()).join('\t');
  });
}

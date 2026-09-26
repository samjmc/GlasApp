/**
 * Line-building is what keeps the PSA table's columns apart, so it is pinned twice: on
 * synthetic items, and on the real July 2026 PSA PDF (248 kB) against its committed lines.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { groupLines, pdfLines, type PositionedText } from './pdf';

const FIXTURES = path.resolve(__dirname, '../__fixtures__/sources');
const item = (str: string, x: number, y: number, width = str.length * 5, height = 10): PositionedText => ({
  str,
  x,
  y,
  width,
  height,
});

describe('groupLines', () => {
  it('orders lines top to bottom and items left to right, whatever order they arrive in', () => {
    const lines = groupLines([item('second', 10, 680), item('b', 60, 700), item('a', 10, 700), item('third', 10, 660)]);
    expect(lines).toEqual(['a\tb', 'second', 'third']);
  });

  it('keeps items a little off the baseline on one line', () => {
    expect(groupLines([item('Deputy Ahern,', 10, 700), item('Ciarán', 80, 701.5)])).toEqual(['Deputy Ahern, Ciarán']);
  });

  it('joins a wide gap with a tab, a word gap with a space, and touching fragments with nothing', () => {
    const lines = groupLines([
      item('Name', 10, 700, 20), // ends at 30
      item('Band', 60, 700, 20), // gap 30 > 1.5 x 10: column
      item('Deputy', 10, 680, 30), // ends at 40
      item('Ahern', 43, 680, 25), // gap 3: word
      item('Cia', 10, 660, 15), // ends at 25
      item('rán', 25, 660, 15), // gap 0: same word
    ]);
    expect(lines).toEqual(['Name\tBand', 'Deputy Ahern', 'Ciarán']);
  });

  it('ignores whitespace items and collapses spaces the items carry themselves', () => {
    const lines = groupLines([item('Deputy ', 10, 700, 35), item(' ', 45, 700, 100, 0), item('  Ahern', 45, 700, 35)]);
    expect(lines).toEqual(['Deputy Ahern']);
  });

  it('returns no lines for a page with no text', () => {
    expect(groupLines([item(' ', 10, 700, 5, 0)])).toEqual([]);
  });
});

describe('pdfLines', () => {
  it('reads the real PSA PDF into one tab-separated line per table row', async () => {
    const pages = await pdfLines(new Uint8Array(readFileSync(path.join(FIXTURES, 'psa-2026-07.pdf'))));
    expect(pages).toHaveLength(3);
    expect(pages[0][1]).toBe('Name\tTAA Band\tNarrative\tDate Paid\tAmount');
    expect(pages[0][2]).toBe('Deputy Ahern, Ciarán\tDublin\tPSA July 2026\t31/07/2026\t€2,445.83');
    expect(pages.flat().filter((l) => l.includes('€'))).toHaveLength(174);
    // The committed PSA fixture is exactly what pdfLines makes of these pages.
    const fixture = JSON.parse(readFileSync(path.join(FIXTURES, 'psa-2026-07-pages-1-2.json'), 'utf8'));
    expect(pages.slice(0, 2)).toEqual(fixture);
  });
});

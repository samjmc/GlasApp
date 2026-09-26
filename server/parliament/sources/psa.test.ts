/**
 * Pinned on pages 1-2 of the real July 2026 file (lines made by pdfLines), which hold every
 * title and band shape the files use, and on single lines copied from other months.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDailPsa, parsePsaPayments, psaMonthFromUrl } from './psa';

const FIXTURES = path.resolve(__dirname, '../__fixtures__/sources');
const HEADER = 'Name\tTAA Band\tNarrative\tDate Paid\tAmount';
const table = (...rows: string[]) => [['Parliamentary Standard Allowance', HEADER, ...rows, '03/09/2026 15:22']];

describe('parsePsaPayments: July 2026, pages 1-2', () => {
  const rows = parsePsaPayments(JSON.parse(readFileSync(path.join(FIXTURES, 'psa-2026-07-pages-1-2.json'), 'utf8')));

  it('reads every row and skips only the page title, table header and print time', () => {
    expect(rows).toHaveLength(124); // 61 + 63
    // Summed independently from the text: €380,053.21.
    expect(rows.reduce((sum, r) => sum + r.amountCents, 0)).toBe(38_005_321);
  });

  it('splits the name cell into title, surname and forenames', () => {
    expect(rows[0]).toEqual({
      title: 'Deputy',
      surname: 'Ahern',
      forenames: 'Ciarán',
      taaBand: 'Dublin',
      narrative: 'PSA July 2026',
      datePaid: '2026-07-31',
      amountCents: 244_583,
    });
    expect(rows.filter((r) => r.surname === 'Murphy').map((r) => [r.title, r.forenames, r.taaBand, r.amountCents])).toEqual([
      ['Deputy', 'Michael', '6', 422_500],
      ['Deputy', 'Paul', 'Dublin', 244_583],
      ['Ceann Comhairle', 'Verona', 'CC', 292_208],
    ]);
    const who = (surname: string) => rows.find((r) => r.surname === surname);
    expect(who('Martin')).toMatchObject({ title: 'Taoiseach', forenames: 'Micheál', taaBand: 'MIN' });
    expect(who('McEntee')).toMatchObject({ title: 'Minster', forenames: 'Helen' }); // sic, in the source
    expect(who('Boyd Barrett')?.forenames).toBe('Richard');
    expect(who('Carroll MacNeill')?.title).toBe('Minister');
    expect(who('Cleere')?.forenames).toBe("Peter 'Chap'");
  });
});

describe('parsePsaPayments: row shapes', () => {
  it('keeps every row of a member with several in a month (March 2025 arrears)', () => {
    const rows = parsePsaPayments(table(
      'Minister Higgins, Emer\tMIN\tPSA March 2025\t28/03/2025\t€1,333.33',
      'Minister Higgins, Emer\tMIN\tPSA Arrears Jan 2025\t28/03/2025\t€70.16',
    ));
    expect(rows.map((r) => [r.narrative, r.amountCents])).toEqual([['PSA March 2025', 133_333], ['PSA Arrears Jan 2025', 7_016]]);
  });

  it('reads a blank band as NULL and a negative amount as negative', () => {
    const [row] = parsePsaPayments(table('Deputy Ward, Mark\tPSA Recoupment July 2026\t31/07/2026\t-€100.00'));
    expect(row).toMatchObject({ taaBand: null, narrative: 'PSA Recoupment July 2026', amountCents: -10_000 });
  });

  it('reads the source typos: a comma after the title, and "Deouty"', () => {
    const [comma, typo] = parsePsaPayments(table(
      'Deputy, Crowe, Sean\t5\tPSA March 2025\t28/03/2025\t€3,000.00',
      'Deouty Cummins, Jen\tDublin\tPSA March 2025\t28/03/2025\t€2,445.83',
    ));
    expect(comma).toMatchObject({ title: 'Deputy', surname: 'Crowe', forenames: 'Sean' });
    expect(typo).toMatchObject({ title: 'Deouty', surname: 'Cummins', forenames: 'Jen' });
  });

  it('reads a row printed with no title (February 2025) with a NULL title', () => {
    const [row] = parsePsaPayments(table('Higgins, Emer\tMIN\tPSA February 2025\t28/02/2025\t€1,333.33'));
    expect(row).toMatchObject({ title: null, surname: 'Higgins', forenames: 'Emer', amountCents: 133_333 });
  });

  it.each([
    ['a name with no comma', 'Deputy Ahern Ciarán\tDublin\tPSA July 2026\t31/07/2026\t€2,445.83', /Surname, Forenames/],
    ['a missing amount', 'Deputy Ahern, Ciarán\tDublin\tPSA July 2026\t31/07/2026', /4 cells, expected 5/],
    ['a short amount', 'Deputy Ahern, Ciarán\tDublin\tPSA July 2026\t31/07/2026\t€2,445.8', /unreadable amount/],
    ['a date that does not exist', 'Deputy Ahern, Ciarán\tDublin\tPSA July 2026\t31/02/2026\t€2,445.83', /unreadable date/],
    ['a stray line', 'Total\t€1,000,000.00', /2 cells, expected 5/],
  ])('throws, quoting the row, on %s', (_, line, error) => {
    expect(() => parsePsaPayments(table(line))).toThrow(error);
    expect(() => parsePsaPayments(table(line))).toThrow(line.split('\t')[0]);
  });

  it('throws on a file with no PSA table header', () => {
    expect(() => parsePsaPayments([['Parliamentary Standard Allowance']])).toThrow(/no table header/);
  });
});

describe('PSA URLs', () => {
  const base = 'https://data.oireachtas.ie/ie/oireachtas/members/parliamentaryAllowances/psa';

  it('reads the month covered, including the split months around the 2024 election', () => {
    expect(psaMonthFromUrl(`${base}/2026/2026-09-03_parliamentary-standard-allowance-payments-to-deputies-for-july-2026_en.pdf`)).toBe('2026-07-01');
    // Published in 2026 for March 2025: the month comes from the name, not the date.
    expect(psaMonthFromUrl(`${base}/2026/2026-02-03_parliamentary-standard-allowance-payments-to-deputies-for-march-2025_en.pdf`)).toBe('2025-03-01');
    expect(psaMonthFromUrl(`${base}/2025/2025-02-17_parliamentary-standard-allowance-payments-to-deputies-for-1-8-november-2024_en.pdf`)).toBe('2024-11-01');
  });

  it('accepts Deputies files in any folder, and nothing else', () => {
    expect(isDailPsa('https://data.oireachtas.ie/ie/oireachtas/caighdeanOifigiul/2026/2026-01-16_parliamentary-standard-allowance-payments-to-deputies-for-november-2025_en.pdf')).toBe(true);
    expect(isDailPsa(`${base}/2026/2026-09-03_parliamentary-standard-allowance-payments-to-senators-for-july-2026_en.pdf`)).toBe(false);
    expect(isDailPsa(`${base}/2024/2024-09-10_end-of-year-statement-of-the-total-psa-paid-to-tds-and-senators-for-2023_en.pdf`)).toBe(false);
    expect(psaMonthFromUrl(`${base}/2026/2026-09-03_parliamentary-standard-allowance-payments-to-deputies-for-julember-2026_en.pdf`)).toBeNull();
  });
});

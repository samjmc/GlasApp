/**
 * Parliamentary Standard Allowance payments to Deputies (monthly PDF) → one row per
 * payment. Pure: takes the page lines from `pdfLines`, where each table row is one line of
 * tab-separated cells: Name, TAA Band, Narrative, Date Paid, Amount. A member can have
 * several rows in a month (arrears are a row of their own).
 */

export interface PsaPayment {
  /** As printed, including the source's own typo "Minster". NULL when the row has none. */
  title: string | null;
  surname: string;
  forenames: string;
  /** Travel and Accommodation Allowance band: "1".."12", "Dublin", "MIN", "CC", "NoTAA", … */
  taaBand: string | null;
  narrative: string;
  /** YYYY-MM-DD */
  datePaid: string;
  amountCents: number;
}

/**
 * Titles that open the Name cell, longest first. "Minster" and "Deouty" (sic) are in the
 * source, and some rows put a comma after the title ("Deputy, Crowe, Sean").
 */
const TITLES = ['Ceann Comhairle', 'Taoiseach', 'Minister', 'Minster', 'Deputy', 'Deouty'];

const PAGE_TITLE = 'Parliamentary Standard Allowance';
const HEADER = 'Name\tTAA Band\tNarrative\tDate Paid\tAmount';
/** Each page ends with the time it was printed, e.g. "03/09/2026 15:22". */
const PRINTED_AT = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const AMOUNT = /^(-?)€(-?)(\d{1,3}(?:,\d{3})*)\.(\d{2})$/;

/** Every payment row, in the file's order. Throws on a line it cannot read. */
export function parsePsaPayments(pages: string[][]): PsaPayment[] {
  const out: PsaPayment[] = [];
  let sawHeader = false;
  for (const line of pages.flat()) {
    if (line === HEADER) sawHeader = true;
    if (line === '' || line === HEADER || line === PAGE_TITLE || PRINTED_AT.test(line)) continue;
    out.push(parseRow(line));
  }
  if (!sawHeader) throw new Error('PSA payments: no table header; not a PSA payments file?');
  return out;
}

function parseRow(line: string): PsaPayment {
  const cells = line.split('\t');
  const fail = (why: string) => new Error(`PSA payments: ${why} in "${line.replace(/\t/g, ' | ')}"`);
  // A blank band leaves four cells; nothing else is ever blank.
  if (cells.length === 4 && /^PSA\b/.test(cells[1])) cells.splice(1, 0, '');
  if (cells.length !== 5) throw fail(`${cells.length} cells, expected 5`);
  const [nameCell, band, narrative, dateCell, amountCell] = cells;

  // Nearly every row opens with a title; a few are printed without one (February 2025:
  // "Higgins, Emer"), which stays NULL rather than failing the whole file.
  const title = TITLES.find((t) => nameCell.startsWith(`${t} `) || nameCell.startsWith(`${t}, `)) ?? null;
  const rest = title ? nameCell.slice(title.length).replace(/^,?\s+/, '') : nameCell;
  const name = rest.match(/^([^,]+),\s*(.+)$/);
  if (!name) throw fail('name is not "Surname, Forenames"');

  const date = dateCell.match(DATE);
  const datePaid = date ? `${date[3]}-${date[2]}-${date[1]}` : '';
  const check = date ? new Date(Date.UTC(+date[3], +date[2] - 1, +date[1])) : null;
  if (!check || check.getUTCMonth() !== +date![2] - 1 || check.getUTCDate() !== +date![1]) throw fail('unreadable date');
  const amount = amountCell.match(AMOUNT);
  if (!amount) throw fail('unreadable amount');
  const cents = Number(amount[3].replace(/,/g, '')) * 100 + Number(amount[4]);

  return {
    title,
    surname: name[1].trim(),
    forenames: name[2].trim(),
    taaBand: band || null,
    narrative,
    datePaid,
    amountCents: amount[1] || amount[2] ? -cents : cents,
  };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** A Deputies' PSA payments file (not the Senators'), judged by file name; the folder varies. */
export function isDailPsa(url: string): boolean {
  return psaMonthFromUrl(url) !== null;
}

/**
 * The month a file covers, as its first day ("…deputies-for-july-2026_en.pdf" → "2026-07-01").
 * Around the 2024 election a month was split by days ("…for-1-8-november-2024", "…for-29-30-
 * november-2024"); both halves give that month.
 */
export function psaMonthFromUrl(url: string): string | null {
  const m = url.match(
    /_parliamentary-standard-allowance-payments-to-deputies-for-(?:\d{1,2}-\d{1,2}-)?([a-z]+)-(\d{4})_[a-z]{2}\.pdf$/i,
  );
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) + 1 : 0;
  return month ? `${m![2]}-${String(month).padStart(2, '0')}-01` : null;
}

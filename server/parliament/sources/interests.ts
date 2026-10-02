/**
 * The Dáil Register of Members' Interests (annual PDF) → one entry per member. Pure: takes
 * the page lines from `pdfLines`. Each entry is "SURNAME, Forenames (Constituency)" then the
 * nine statutory categories, each a label and the declared text, which can wrap over many
 * lines and across pages.
 */

export type InterestCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface InterestsEntry {
  /** As printed, in capitals ("BOYD BARRETT"). */
  surname: string;
  forenames: string;
  constituency: string | null;
  /** All nine, in order. `text` is NULL when the member declared nothing. */
  categories: Array<{ number: InterestCategory; text: string | null }>;
}

/** The printed label of each category, in order. */
const LABELS: Array<[InterestCategory, string]> = [
  [1, 'Occupations Etc'],
  [2, 'Shares Etc'],
  [3, 'Directorships'],
  [4, 'Land (including property)'],
  [5, 'Gifts'],
  [6, 'Property supplied or lent'],
  [7, 'Travel Facilities'],
  [8, 'Remunerated Position'],
  [9, 'Contracts'],
];

/** "N. Label", its leader dots, then the start of the declared text. */
const LABEL_RES = LABELS.map(
  ([n, label]) => new RegExp(`^${n}\\.\\s*${label.replace(/[()]/g, '\\$&')}[\\s….]*([\\s\\S]*)$`, 'i'),
);
/** Category 6's label wraps onto a second line, which can also carry a line of the text. */
const LABEL_6_TAIL = /^or a Service supplied\s*([\s\S]*)$/i;

/** "SURNAME, Forenames (Constituency)"; the surname is in capitals. */
const HEADER_RE = /^([A-ZÁÉÍÓÚ'’][A-ZÁÉÍÓÚ'’ -]*),\s*([^()]+?)\s*(?:\(([^()]+)\))?$/;

/**
 * The register's words for "nothing to declare", English and Irish, lower-cased. A category
 * declares nothing when every colon-separated part of its text is one of these: "Nil", "None:
 * not applicable", "Ceann ar bith: Ní bhaineann le hábhar: Ní bhaineann le hábhar". Free-text
 * denials ("I do not own any shares.") are kept as text.
 */
const NIL_PARTS = new Set([
  'nil',
  'none',
  'not applicable',
  'níl',
  'neamh-infheidhme',
  'neamh-fheidhme',
  'náid',
  'toradh nialasach',
  'ceann ar bith',
  'ní bhaineann le hábhar',
]);

/** The Clerk's signature closes the register; nothing from it on belongs to a member. */
const SIGNATURE_RE = /^Cléireach Dháil Éireann/;

/** Every member's entry, in the register's order. Throws on an entry it cannot read. */
export function parseInterestsRegister(pages: string[][]): InterestsEntry[] {
  let lines = pages
    .flatMap((page, i) => withoutPageNumber(page, i + 1))
    .map((l) => l.replace(/\t/g, ' ').trim())
    .filter((l) => l !== '');
  const signature = lines.findIndex((l) => SIGNATURE_RE.test(l));
  // The Clerk's name is the line above the title.
  if (signature > 0) lines = lines.slice(0, signature - 1);

  // An entry starts at the line above each "1. Occupations"; that line must be a header.
  const starts: number[] = [];
  lines.forEach((line, i) => {
    if (!LABEL_RES[0].test(line)) return;
    if (i === 0 || !HEADER_RE.test(lines[i - 1])) {
      throw new Error(`Interests register: no member header above "${line}" (found "${lines[i - 1] ?? ''}")`);
    }
    starts.push(i - 1);
  });

  return starts.map((start, k) => parseEntry(lines.slice(start, starts[k + 1] ?? lines.length)));
}

/**
 * Some years (2024) print the page number top right, as the page's first line. Left in, it
 * would join the text before it ("Nil 3").
 */
function withoutPageNumber(page: string[], pageNo: number): string[] {
  return page[0] === String(pageNo) ? page.slice(1) : page;
}

/** One entry's lines, header first. */
function parseEntry(lines: string[]): InterestsEntry {
  const [, surname, forenames, constituency] = lines[0].match(HEADER_RE)!;
  const name = lines[0];
  const texts: string[][] = [];
  let sawLabel6Tail = false;
  for (const line of lines.slice(1)) {
    const next = texts.length; // index of the next category expected
    const start = next < LABEL_RES.length ? line.match(LABEL_RES[next]) : null;
    if (start) {
      texts.push(start[1] ? [start[1]] : []);
      continue;
    }
    if (next === 0) throw new Error(`Interests register: ${name}: unexpected "${line}" before category 1`);
    // Category 6's label tail can sit beside its first, second or a later line of text.
    const tail = next === 6 && !sawLabel6Tail ? line.match(LABEL_6_TAIL) : null;
    if (tail) {
      sawLabel6Tail = true;
      if (tail[1]) texts[5].push(tail[1]);
    } else {
      texts[next - 1].push(line);
    }
  }
  if (texts.length !== LABELS.length) {
    throw new Error(`Interests register: ${name}: found ${texts.length} of ${LABELS.length} categories`);
  }
  return {
    surname: surname.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim(),
    forenames: forenames.replace(/\s+/g, ' ').trim(),
    constituency: constituency?.replace(/\s+/g, ' ').trim() || null,
    categories: LABELS.map(([number], i) => ({ number, text: declared(texts[i]) })),
  };
}

/** The lines of one category → its text, or NULL when it declares nothing. */
function declared(lines: string[]): string | null {
  // A word broken at a hyphen ("non-" / "remunerated") joins without a space.
  const text = lines
    .reduce((acc, line) => (acc === '' ? line : /[A-Za-zÀ-ÿ]-$/.test(acc) ? acc + line : `${acc} ${line}`), '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = text.replace(/\.$/, '').toLowerCase().split(':');
  return parts.every((p) => p.trim() === '' || NIL_PARTS.has(p.trim())) ? null : text;
}

/**
 * A Dáil register itself: not the Seanad's, and not a supplement ("supplement-to-register-of-
 * members-interests-2024-dail"). Judged by file name; the folder is not reliable.
 */
export function isDailInterestsRegister(url: string): boolean {
  return /\/\d{4}-\d{2}-\d{2}_register-of-member-?s-interests-dail-eireann[-_][^/]*\.pdf$/i.test(url);
}

/**
 * The year a register covers, from its file name ("…dail-eireann-2025_en.pdf" → 2025).
 * NULL when the name gives no single year: registers before 2023 have none, and one covers
 * "2022-2024".
 */
export function interestsYearFromUrl(url: string): number | null {
  const m = url.match(/_register-of-member-?s-interests-dail-eireann-(\d{4})_[a-z]{2}\.pdf$/i);
  return m ? Number(m[1]) : null;
}

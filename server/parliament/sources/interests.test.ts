/**
 * Pinned on trimmed page lines of the real registers (made by pdfLines): the first six
 * members of 2025, plus a label-6 tail that carries text, two all-Irish entries, a long
 * category across a page break, the last member before the Clerk's signature, and three
 * members of 2024, which prints page numbers.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { interestsYearFromUrl, isDailInterestsRegister, parseInterestsRegister, type InterestsEntry } from './interests';

const FIXTURES = path.resolve(__dirname, '../__fixtures__/sources');
const fixture = (name: string): string[][] => JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8'));
const text = (entry: InterestsEntry | undefined, n: number) => entry?.categories[n - 1].text;

/** A minimal entry: category n has text `texts[n-1]`, or "Nil". */
function entryLines(header: string, texts: Record<number, string[]> = {}): string[] {
  const labels = ['Occupations Etc', 'Shares Etc', 'Directorships', 'Land (including property)', 'Gifts',
    'Property supplied or lent', 'Travel Facilities', 'Remunerated Position', 'Contracts'];
  const lines = [header];
  labels.forEach((label, i) => {
    const [first = 'Nil', ...rest] = texts[i + 1] ?? [];
    lines.push(`${i + 1}. ${label}………… ${first}`, ...rest);
    if (i === 5 && !texts[6]) lines.push('or a Service supplied');
  });
  return lines;
}

describe('parseInterestsRegister: 2025 register', () => {
  const entries = parseInterestsRegister(fixture('interests-2025-trimmed.json'));
  const bySurname = (s: string) => entries.find((e) => e.surname === s);

  it('reads every member in the fixture, in order, each with all nine categories', () => {
    expect(entries.map((e) => e.surname)).toEqual([
      'AHERN', 'AIRD', 'ARDAGH', 'BACIK', 'BENNETT', 'BOLAND', 'LOWRY', 'Ó SNODAIGH', 'WARD', 'WHITMORE',
    ]);
    for (const e of entries) expect(e.categories.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(entries[0]).toMatchObject({ forenames: 'Ciarán', constituency: 'Dublin South-West' });
  });

  it('gives NULL for Nil and the declared text otherwise, with its lines joined', () => {
    const ahern = bySurname('AHERN');
    expect(ahern?.categories.map((c) => c.text === null)).toEqual([true, true, true, true, true, true, false, true, true]);
    expect(text(ahern, 7)).toBe(
      'Housing study visit to Vienna (flights, meals, hotel): Friedrich-Ebert-Stiftung, 31/32 Parnell Sq, Dublin.',
    );
    expect(text(bySurname('AIRD'), 1)).toBe('Farmer and public representative: Nutgrove, Portlaoise, Laois.');
  });

  it('follows a category across a page break and keeps the categories after it', () => {
    const bacik = bySurname('BACIK'); // category 7 starts on page 4, after 1-6 on page 3
    expect(text(bacik, 7)).toMatch(/^\(1\) Parliamentary Party visit to European Parliament \(flights, meals, hotel\)/);
    expect(text(bacik, 7)).toMatch(/\(4\) speaker; \(5\) speaker\.$/);
    expect([text(bacik, 8), text(bacik, 9)]).toEqual([null, null]);
    const bennett = bySurname('BENNETT'); // category 9 is alone on the next page
    expect(text(bennett, 8)).toBe('TD (Teachta Dála): Dáil Éireann, Houses of the Oireachtas, Leinster House, Kildare Street, Dublin.');
    expect(text(bennett, 9)).toBeNull();
    expect(text(bySurname('LOWRY'), 4)).toMatch(/; \(6\) 1 Montrose Avenue, Foxwood, Kilbarry, Co\. Waterford: rental\.$/);
  });

  it('drops the second line of the category 6 label but keeps the text beside it', () => {
    expect(text(bySurname('LOWRY'), 6)).toBe('Office: Garuda T/A Streamline Enterprises, Abbey Road, Thurles, Co. Tipperary.');
    for (const e of entries) for (const c of e.categories) expect(c.text ?? '').not.toMatch(/or a Service supplied/);
  });

  it('reads entries written in Irish, including their words for "nothing to declare"', () => {
    const snodaigh = bySurname('Ó SNODAIGH');
    expect(snodaigh?.constituency).toBe('Baile Átha Cliath Lár-Theas');
    expect(snodaigh?.categories.filter((c) => c.text !== null).map((c) => c.number)).toEqual([3]); // the rest: Neamh-infheidhme
    expect(text(snodaigh, 3)).toMatch(/^Cathaoirleach an Charthanacht: \(i\) Liberties Recycling Training/);
    expect(text(snodaigh, 3)).toContain('(iii) Liberties Global Exports, Unit D1C, Bluebell Industrial Estate, BÁC 12:');
    expect(text(snodaigh, 3)).toMatch(/\(4\) Stiúrthóir neamh-fheidhmiúchán: Bluebell Community Council, .* grúpa comhphobail\.$/);
    // "Ceann ar bith: Ní bhaineann le hábhar[: Ní bhaineann le hábhar]." = "None: not applicable".
    const ward = bySurname('WARD');
    expect(ward?.categories.filter((c) => c.text !== null).map((c) => c.number)).toEqual([1, 4, 7]);
    expect(text(ward, 7)).toMatch(/^Turas go Taiwan mar chuid de thoscaireacht pharlaiminteach \(19-26 Iúil 2025\), lena n-áirítear/);
  });

  it("stops at the Clerk's signature instead of adding it to the last member", () => {
    const whitmore = bySurname('WHITMORE');
    expect(text(whitmore, 9)).toBeNull();
    expect(text(whitmore, 3)).toBe('Member of Oireachtas Commission: Houses of the Oireachtas, Leinster House, Kildare Street, Dublin 2.');
  });
});

describe('parseInterestsRegister: 2024 register', () => {
  it('drops the printed page numbers instead of adding them to the text', () => {
    const entries = parseInterestsRegister(fixture('interests-2024-trimmed.json'));
    expect(entries.map((e) => e.surname)).toEqual(['AHERN', 'AIRD', 'ARDAGH']);
    // AIRD's category 7 ends page 2; page 3 opens with its number, "3".
    expect(entries[1].categories.slice(6).map((c) => c.text)).toEqual([null, null, null]);
    expect(entries[0].categories[0].text).toBe('Solicitor: McInnes Dunne Murphy LLP, 6 Mount Street Crescent, Dublin 2.');
  });
});

describe('parseInterestsRegister: edge cases', () => {
  it('finds the category 6 label tail after the second line of text (as in 2024)', () => {
    const [entry] = parseInterestsRegister([
      entryLines('LAWLESS, James (Kildare North)', {
        6: ['Room in office to conduct weekly advice clinics: Brid', 'Feely, Main Street, Maynooth.', 'or a Service supplied'],
      }),
    ]);
    expect(text(entry, 6)).toBe('Room in office to conduct weekly advice clinics: Brid Feely, Main Street, Maynooth.');
  });

  it('keeps "Nil" with other information as text, and free-text denials as text', () => {
    const [entry] = parseInterestsRegister([
      entryLines('MCGRATH, Séamus (Cork South-Central)', {
        2: ['I do not own any shares.'],
        4: ['Nil', 'Other Information Provided: only property held is family home.'],
        5: ['None: not applicable.'],
        7: ['Níl'],
      }),
    ]);
    expect(text(entry, 2)).toBe('I do not own any shares.');
    expect(text(entry, 4)).toBe('Nil Other Information Provided: only property held is family home.');
    expect([text(entry, 5), text(entry, 7)]).toEqual([null, null]);
  });

  it('joins a word broken at a hyphen without a space, and normalises the header', () => {
    const [entry] = parseInterestsRegister([
      entryLines('HEALY- RAE, Danny (Kerry)', { 3: ['Voluntary, non-', 'remunerated role.'] }),
    ]);
    expect(entry).toMatchObject({ surname: 'HEALY-RAE', forenames: 'Danny', constituency: 'Kerry' });
    expect(text(entry, 3)).toBe('Voluntary, non-remunerated role.');
  });

  it('throws, naming the member, when an entry is missing categories', () => {
    const lines = entryLines('BRADY, John (Wicklow)').filter((l) => !l.startsWith('8.'));
    expect(() => parseInterestsRegister([lines])).toThrow(/BRADY, John \(Wicklow\): found 7 of 9 categories/);
  });

  it('throws when the line above a "1. Occupations" is not a member header', () => {
    const lines = entryLines('BRADY, John (Wicklow)');
    lines[0] = 'Theas)'; // e.g. a header that wrapped onto two lines
    expect(() => parseInterestsRegister([lines])).toThrow(/no member header above "1\. Occupations[\s\S]*found "Theas\)"/);
  });

  it('returns no entries for pages with no register in them', () => {
    expect(parseInterestsRegister([['ETHICS IN PUBLIC OFFICE ACTS, 1995 AND 2001']])).toEqual([]);
  });
});

describe('register URLs', () => {
  const base = 'https://data.oireachtas.ie/ie/oireachtas/members/registerOfMembersInterests';

  it('reads the year covered, and NULL when the name has no single year', () => {
    expect(interestsYearFromUrl(`${base}/dail/2026/2026-02-25_register-of-member-s-interests-dail-eireann-2025_en.pdf`)).toBe(2025);
    expect(interestsYearFromUrl(`${base}/dail/2025/2025-06-18_register-of-member-s-interests-dail-eireann-2022-2024_en.pdf`)).toBeNull();
    expect(interestsYearFromUrl(`${base}/dail/2022/2022-02-16_register-of-members-interests-dail-eireann_en.pdf`)).toBeNull();
  });

  it('accepts Dáil registers only: not the Seanad, not supplements', () => {
    expect(isDailInterestsRegister(`${base}/dail/2026/2026-02-25_register-of-member-s-interests-dail-eireann-2025_en.pdf`)).toBe(true);
    expect(isDailInterestsRegister(`${base}/dail/2022/2022-02-16_register-of-members-interests-dail-eireann_en.pdf`)).toBe(true);
    expect(isDailInterestsRegister(`${base}/seanad/2026/2026-03-10_register-of-member-s-interests-seanad-eireann-2025_en.pdf`)).toBe(false);
    expect(isDailInterestsRegister(`${base}/dail/2026/2026-02-13_supplement-to-register-of-members-interests-2024-dail_en.pdf`)).toBe(false);
  });
});

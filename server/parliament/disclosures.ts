/**
 * The two Oireachtas PDF publications the API does not carry, read per TD:
 *   - the Register of Members' Interests (annual, Dáil), from the register covering the
 *     year the current Dáil began onwards;
 *   - Parliamentary Standard Allowance payments to Deputies (monthly), from the first full
 *     month of the current Dáil.
 * A published file does not change, so each is read once; later runs read only new files.
 * Names are matched to the roster (the PDFs carry no member code); a name that does not
 * match, or matches only loosely where another name in the file already claims that TD, is
 * reported and never stored against a guessed member.
 */
import { interestsYearFromUrl, isDailInterestsRegister, parseInterestsRegister } from './sources/interests';
import { browserFetch, publicationLinks } from './sources/listing';
import { makeNameMatcher, type NameMatch, type RosterName } from './sources/names';
import { pdfLines } from './sources/pdf';
import { isDailPsa, parsePsaPayments, psaMonthFromUrl } from './sources/psa';
import * as repo from './repository';

export interface DisclosureSource {
  /** One listing page of a publications topic, newest first. */
  links(topic: string, page: number): Promise<string[]>;
  /** A PDF's text, as page lines. */
  pages(url: string): Promise<string[][]>;
}

export const liveDisclosureSource: DisclosureSource = {
  links: (topic, page) => publicationLinks(topic, browserFetch, page),
  async pages(url) {
    const res = await browserFetch(url);
    if (!res.ok) throw new Error(`Oireachtas ${res.status} for ${url}`);
    return pdfLines(new Uint8Array(await res.arrayBuffer()));
  },
};

/** Listing pages read at most, per topic (50 files a page). */
const MAX_LISTING_PAGES = 6;

/** The publication date that opens an Oireachtas file name ("…/2026-02-03_…pdf"). */
const publishedOn = (url: string) => url.match(/\/(\d{4}-\d{2}-\d{2})_[^/]*$/)?.[1] ?? '';

export interface DisclosureContext {
  roster: RosterName[];
  tdIds: Map<string, number>;
  /** First day of the current Dáil, YYYY-MM-DD. */
  dailStart: string;
  source?: DisclosureSource;
  log: (line: string) => void;
}

export interface DisclosureResult {
  files: number;
  rows: number;
  /** Names read from a file that matched no current TD, "Surname, Forenames". */
  unmatched: string[];
}

type PrintedName = { surname: string; forenames: string; constituency?: string | null };

/**
 * Match every item of one file. An item is kept when its match is exact, or when it is the
 * only printed name in the file that leads to that TD. A loose match that collides with
 * another printed name is dropped and reported as ambiguous.
 */
function matchFile<T>(items: T[], nameOf: (t: T) => PrintedName, match: (n: PrintedName) => NameMatch | null) {
  const printed = (n: PrintedName) => `${n.surname}, ${n.forenames}`;
  const found = items.map((item, index) => ({ item, index, name: nameOf(item), m: match(nameOf(item)) }));
  const namesPerMember = new Map<string, Set<string>>();
  for (const f of found) {
    if (f.m) namesPerMember.set(f.m.memberCode, (namesPerMember.get(f.m.memberCode) ?? new Set()).add(printed(f.name)));
  }
  const matched: Array<{ memberCode: string; item: T; index: number }> = [];
  const unmatched: string[] = [];
  for (const f of found) {
    if (!f.m) unmatched.push(printed(f.name));
    else if (f.m.exact || namesPerMember.get(f.m.memberCode)!.size === 1) matched.push({ memberCode: f.m.memberCode, item: f.item, index: f.index });
    else unmatched.push(`${printed(f.name)} (ambiguous)`);
  }
  return { matched, unmatched: Array.from(new Set(unmatched)) };
}

export async function syncInterests(ctx: DisclosureContext): Promise<DisclosureResult> {
  const source = ctx.source ?? liveDisclosureSource;
  const fromYear = Number(ctx.dailStart.slice(0, 4));
  const stored = await repo.storedDisclosureSources();
  // Registers are few; page 1 holds the newest years. A year re-issued keeps only its newest
  // file, chosen BEFORE the stored check, or the two files would replace each other forever.
  const newestByYear = new Map<number, string>();
  for (const url of (await source.links('register-of-members-interests', 1)).filter(isDailInterestsRegister)) {
    const year = interestsYearFromUrl(url);
    if (year === null || year < fromYear) continue;
    const seen = newestByYear.get(year);
    if (!seen || publishedOn(url) > publishedOn(seen)) newestByYear.set(year, url);
  }
  const registers = Array.from(newestByYear.values());
  const match = makeNameMatcher(ctx.roster);
  const result: DisclosureResult = { files: 0, rows: 0, unmatched: [] };
  for (const url of registers) {
    if (stored.has(url)) continue;
    const entries = parseInterestsRegister(await source.pages(url));
    const { matched, unmatched } = matchFile(entries, (e) => e, match);
    // One TD has one entry in a register: two entries for one TD cannot both be theirs.
    const perMember = new Map<string, number>();
    for (const m of matched) perMember.set(m.memberCode, (perMember.get(m.memberCode) ?? 0) + 1);
    const kept = matched.filter((m) => perMember.get(m.memberCode) === 1);
    for (const m of matched) if (perMember.get(m.memberCode)! > 1) unmatched.push(`${m.item.surname}, ${m.item.forenames} (twice)`);
    await repo.replaceInterestsYear(interestsYearFromUrl(url)!, url, kept.map((m) => ({ memberCode: m.memberCode, entry: m.item })), unmatched, ctx.tdIds);
    result.files++;
    result.rows += kept.length;
    result.unmatched.push(...unmatched);
    ctx.log(`Interests ${interestsYearFromUrl(url)}: ${kept.length} of ${entries.length} entries matched.`);
  }
  return result;
}

/** The first full month of the Dáil: a partial first month mixes in the previous Dáil. */
function firstFullMonth(dailStart: string): string {
  const [y, m, d] = dailStart.split('-').map(Number);
  if (d === 1) return `${dailStart.slice(0, 7)}-01`;
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export async function syncAllowances(ctx: DisclosureContext): Promise<DisclosureResult> {
  const source = ctx.source ?? liveDisclosureSource;
  const firstMonth = firstFullMonth(ctx.dailStart);
  const stored = await repo.storedDisclosureSources();
  // A month can be published twice (March 2025 was re-published in February 2026): keep only
  // the newest file for each month.
  const newest = new Map<string, string>();
  for (let page = 1; page <= MAX_LISTING_PAGES; page++) {
    const links = await source.links('parliamentary-allowances', page);
    const dail = links.filter(isDailPsa).map((url) => ({ url, month: psaMonthFromUrl(url) }));
    for (const f of dail) {
      if (!f.month || f.month < firstMonth) continue;
      const seen = newest.get(f.month);
      if (!seen || publishedOn(f.url) > publishedOn(seen)) newest.set(f.month, f.url);
    }
    // Newest first: stop once a page reaches back past the Dáil's first month.
    if (links.length === 0 || dail.some((f) => f.month !== null && f.month < firstMonth)) break;
  }
  const files = Array.from(newest, ([month, url]) => ({ url, month }));
  const match = makeNameMatcher(ctx.roster);
  const result: DisclosureResult = { files: 0, rows: 0, unmatched: [] };
  for (const { url, month } of files) {
    if (stored.has(url)) continue;
    const payments = parsePsaPayments(await source.pages(url));
    // A member can have several rows in a month (arrears), all under one printed name.
    const { matched, unmatched } = matchFile(payments, (p) => p, match);
    await repo.replaceAllowanceFile(url, month, matched.map((m) => ({ memberCode: m.memberCode, payment: m.item, position: m.index })), unmatched, ctx.tdIds);
    result.files++;
    result.rows += matched.length;
    for (const u of unmatched) if (!result.unmatched.includes(u)) result.unmatched.push(u);
  }
  if (result.files) ctx.log(`Allowances: ${result.rows} payments from ${result.files} new files.`);
  return result;
}

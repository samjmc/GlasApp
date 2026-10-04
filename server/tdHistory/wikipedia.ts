/**
 * The Wikipedia side of TD history: the newest revision that is at least REVISION_MIN_AGE_HOURS
 * old (most vandalism is reverted within that time), and that revision's parsed HTML.
 */
import { USER_AGENT } from '../parliament/sources/wikidata';

const API = 'https://en.wikipedia.org/w/api.php';
export const REVISION_MIN_AGE_HOURS = 72;

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface Revision {
  /** The page title after following redirects. */
  title: string;
  revisionId: number;
}

export type RevisionLookup = Revision | 'missing' | 'disambiguation';

async function call(params: Record<string, string>, fetcher: Fetcher): Promise<any> {
  const query = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const res = await fetcher(`${API}?${query}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const body = await res.json();
  if (body?.error) throw new Error(`Wikipedia ${body.error.code}: ${body.error.info}`);
  return body;
}

/** The revision to read for `title`: the newest one at least REVISION_MIN_AGE_HOURS old. */
export async function findRevision(title: string, now: Date, fetcher: Fetcher = fetch): Promise<RevisionLookup> {
  const cutoff = new Date(now.getTime() - REVISION_MIN_AGE_HOURS * 3_600_000).toISOString();
  const body = await call(
    { action: 'query', redirects: '1', titles: title, prop: 'revisions|pageprops', rvprop: 'ids', rvlimit: '1', rvdir: 'older', rvstart: cutoff },
    fetcher,
  );
  const page = body?.query?.pages?.[0];
  if (!page || page.missing || page.invalid) return 'missing';
  if (page.pageprops && Object.prototype.hasOwnProperty.call(page.pageprops, 'disambiguation')) return 'disambiguation';
  const revisionId = page.revisions?.[0]?.revid;
  // A page created in the last REVISION_MIN_AGE_HOURS has no old-enough revision yet.
  if (typeof revisionId !== 'number') return 'missing';
  return { title: String(page.title), revisionId };
}

/** That exact revision's rendered HTML. */
export async function revisionHtml(revisionId: number, fetcher: Fetcher = fetch): Promise<string> {
  const body = await call({ action: 'parse', oldid: String(revisionId), prop: 'text', disabletoc: '1', disableeditsection: '1' }, fetcher);
  const html = body?.parse?.text;
  if (typeof html !== 'string') throw new Error(`Wikipedia parse of revision ${revisionId} returned no text`);
  return html;
}

/** A link to exactly the revision that was checked, not to the live page. */
export const revisionUrl = (revisionId: number) => `https://en.wikipedia.org/w/index.php?oldid=${revisionId}`;

/**
 * oireachtas.ie publication listings → links to the PDFs on data.oireachtas.ie. The listing
 * pages are HTML for browsers, so requests send a browser User-Agent. Newest first, 50 to a
 * page.
 */
import { load } from 'cheerio';
import type { Fetcher } from '../client';

const LISTING_URL = 'https://www.oireachtas.ie/en/publications/';
const TIMEOUT_MS = 60_000;
/** A plain browser User-Agent. Nothing that identifies a person. */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export const browserFetch: Fetcher = (url) =>
  fetch(url, { headers: { 'User-Agent': BROWSER_USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });

/** Pure: every data.oireachtas.ie PDF linked from a listing page, in page order, once each. */
export function parsePublicationLinks(html: string): string[] {
  const $ = load(html);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    let url: URL;
    try {
      url = new URL($(el).attr('href')!, LISTING_URL);
    } catch {
      return;
    }
    if (url.hostname === 'data.oireachtas.ie' && /\.pdf$/i.test(url.pathname) && !links.includes(url.href)) {
      links.push(url.href);
    }
  });
  return links;
}

/** The PDFs on one page of a topic's listing, e.g. "register-of-members-interests". */
export async function publicationLinks(topic: string, fetcher: Fetcher = browserFetch, page = 1): Promise<string[]> {
  const qs = new URLSearchParams({ 'topic[]': topic, resultsPerPage: '50', page: String(page) });
  const res = await fetcher(`${LISTING_URL}?${qs}`);
  if (!res.ok) throw new Error(`Oireachtas listing ${res.status} for ${topic}`);
  return parsePublicationLinks(await res.text());
}

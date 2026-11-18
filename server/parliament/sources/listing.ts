/**
 * oireachtas.ie pages → links to the disclosure PDFs on data.oireachtas.ie.
 *
 * Since November 2026 the publications search (`/en/publications/?topic[]=…`) answers every
 * script with HTTP 405 and a "Human Verification" page (an AWS WAF challenge), and robots.txt
 * disallows it (`Disallow: /*?`). We do not work around that. Two plain pages, listed in the
 * site's sitemap, allowed by robots.txt and served to scripts, carry the same links instead:
 *   - the Register of Members' Interests page lists every register and supplement;
 *   - the Salaries and Allowances page lists the five newest PSA payment files ("Recently
 *     published returns", Deputies and Senators), about two months of Deputies' files.
 * The API (api.oireachtas.ie) has no publications; data.oireachtas.ie has no listing.
 * Requests say who we are. They never pose as a browser.
 */
import { load } from 'cheerio';
import type { Fetcher } from '../client';
import { USER_AGENT } from './wikidata';

const TIMEOUT_MS = 60_000;

export type DisclosureKind = 'interests' | 'allowances';

/** The page whose links each feed reads. */
export const DISCLOSURE_PAGES: Record<DisclosureKind, string> = {
  interests: 'https://www.oireachtas.ie/en/members/register-of-members-interests/',
  allowances: 'https://www.oireachtas.ie/en/members/salaries-and-allowances/',
};

/** Every request to oireachtas.ie and data.oireachtas.ie: our own name, nothing personal. */
export const oireachtasFetch: Fetcher = (url) =>
  fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });

/** Pure: the site's bot challenge, not the page asked for. */
export function isHumanVerification(status: number, html: string): boolean {
  return status === 405 || /<title>\s*Human Verification\s*<\/title>/i.test(html);
}

/** Pure: every data.oireachtas.ie PDF linked from a page, in page order, once each. */
export function parsePublicationLinks(html: string, pageUrl: string): string[] {
  const $ = load(html);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    let url: URL;
    try {
      url = new URL($(el).attr('href')!, pageUrl);
    } catch {
      return;
    }
    if (url.hostname === 'data.oireachtas.ie' && /\.pdf$/i.test(url.pathname) && !links.includes(url.href)) {
      links.push(url.href);
    }
  });
  return links;
}

/** The PDFs linked from one feed's page. Throws on an HTTP error or the bot challenge. */
export async function disclosureLinks(kind: DisclosureKind, fetcher: Fetcher = oireachtasFetch): Promise<string[]> {
  const pageUrl = DISCLOSURE_PAGES[kind];
  const res = await fetcher(pageUrl);
  const html = await res.text();
  if (isHumanVerification(res.status, html)) {
    throw new Error(`oireachtas.ie answered ${pageUrl} with its Human Verification challenge (HTTP ${res.status}); see docs/deploy.md, "Disclosure files"`);
  }
  if (!res.ok) throw new Error(`Oireachtas ${res.status} for ${pageUrl}`);
  return parsePublicationLinks(html, pageUrl);
}

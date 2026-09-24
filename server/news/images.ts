/**
 * Picking the picture for an article.
 *
 *   1. Take every image the feed offers, upgraded where the publisher's CDN has a known
 *      larger rendition (RTÉ serves -1600 beside the -800 in its feed).
 *   2. If none is known to be at least MIN_GOOD_WIDTH wide, read the article page's
 *      og:image / twitter:image. Measured 2026-09-24: this is the ONLY image for Gript and
 *      Newstalk, and a larger one for the Irish Times, Examiner and The Currency.
 *   3. Check candidates in order and keep the first that really loads as an image, so the
 *      feed never stores a dead link.
 */

export interface ImageCandidate {
  url: string;
  /** Width in px when the feed or page states it. */
  width: number | null;
  origin: 'feed' | 'page';
}

export const MIN_GOOD_WIDTH = 800;
const PAGE_IMAGE_ASSUMED_WIDTH = 1200;
const IMAGE_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; GlasPoliticsBot/1.0; +https://glaspolitics.ie)';

/** Absolute http(s) URL with HTML entities decoded, or null. */
export function cleanImageUrl(raw: string | undefined | null, base?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim().replace(/&amp;/g, '&'), base);
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Known publisher CDN patterns with a larger rendition at a predictable URL. */
export function upgradeImage(c: ImageCandidate): ImageCandidate {
  // RTÉ: https://www.rte.ie/images/<id>-800.jpg -> -1600 (what their own article page uses).
  const rte = c.url.match(/^(https:\/\/www\.rte\.ie\/images\/[0-9a-f]+)-(\d{3,4})(\.jpe?g)$/i);
  if (rte && Number(rte[2]) < 1600) return { ...c, url: `${rte[1]}-1600${rte[3]}`, width: 1600 };
  return c;
}

/**
 * Feed candidates plus their upgrades, de-duplicated, widest first (unknown widths last).
 * The original stays in the list behind its upgrade, in case the larger rendition is missing.
 */
export function rankFeedImages(raw: ImageCandidate[]): ImageCandidate[] {
  const seen = new Set<string>();
  const out: ImageCandidate[] = [];
  for (const c of raw.flatMap((r) => [upgradeImage(r), r])) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
  }
  return out.sort((a, b) => (b.width ?? -1) - (a.width ?? -1));
}

/** True when the page should be read for a better picture. */
export function needsPageImage(ranked: ImageCandidate[]): boolean {
  return !ranked.some((c) => c.width !== null && c.width >= MIN_GOOD_WIDTH);
}

/** Order to try: the page image beats a feed image that is not known to be good. */
export function candidateOrder(feed: ImageCandidate[], page: ImageCandidate | null): ImageCandidate[] {
  const good = feed.filter((c) => c.width !== null && c.width >= MIN_GOOD_WIDTH);
  const rest = feed.filter((c) => !good.includes(c));
  const pageFirst = page ? [{ ...page, width: page.width ?? PAGE_IMAGE_ASSUMED_WIDTH }] : [];
  return [...good, ...pageFirst.filter((p) => !good.some((g) => g.url === p.url)), ...rest.filter((c) => c.url !== page?.url)];
}

/** Does this URL answer as an image? One byte is enough to know. */
export async function loadsAsImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0', Accept: 'image/*' },
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      redirect: 'follow',
    });
    await res.body?.cancel();
    return (res.status === 200 || res.status === 206) && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch {
    return false;
  }
}

/** The first candidate that loads, or null. */
export async function firstLoading(candidates: ImageCandidate[], check = loadsAsImage): Promise<ImageCandidate | null> {
  for (const c of candidates) if (await check(c.url)) return c;
  return null;
}

/**
 * Read one feed. RSS 2.0 and Atom both arrive through rss-parser; the HTTP fetch is ours so
 * it has a timeout, a retry and a real status code in the error.
 */
import Parser from 'rss-parser';
import { cleanImageUrl, type ImageCandidate } from './images';
import type { RawItem } from './normalize';

type MediaNode = { $?: { url?: string; medium?: string; type?: string; width?: string } };
type AtomLink = { $?: { href?: string; rel?: string; type?: string } };

export interface FeedEntry {
  link?: string;
  title?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  summary?: string;
  content?: string;
  contentEncoded?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: MediaNode[];
  mediaThumbnail?: MediaNode[];
  links?: AtomLink[];
}

export const FEED_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1_500;
const USER_AGENT = 'GlasPoliticsBot/1.0 (+https://glaspolitics.ie)';

const parser: Parser<Record<string, unknown>, FeedEntry> = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded'],
      // Atom: the Examiner puts its image in a second <link rel="enclosure">.
      ['link', 'links', { keepArray: true }],
    ],
  },
});

const isImage = (type?: string, medium?: string) => medium === 'image' || !type || type.startsWith('image');
const width = (w?: string) => (w && /^\d+$/.test(w) ? Number(w) : null);

/** Every image the entry offers, in feed order. Pure. */
export function imagesOf(entry: FeedEntry): ImageCandidate[] {
  const out: ImageCandidate[] = [];
  const add = (url: string | undefined, w: number | null) => {
    const clean = cleanImageUrl(url);
    if (clean) out.push({ url: clean, width: w, origin: 'feed' });
  };
  for (const m of entry.mediaContent ?? []) if (isImage(m.$?.type, m.$?.medium)) add(m.$?.url, width(m.$?.width));
  if (entry.enclosure?.url && isImage(entry.enclosure.type)) add(entry.enclosure.url, null);
  for (const m of entry.mediaThumbnail ?? []) add(m.$?.url, width(m.$?.width));
  for (const l of entry.links ?? []) if (l.$?.rel === 'enclosure' && isImage(l.$.type)) add(l.$.href, null);
  // Last resort: the first <img> in the body HTML (WordPress and Ghost feeds).
  const html = entry.contentEncoded ?? entry.content ?? '';
  const img = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (img) add(img[1], width(img[0].match(/width=["']?(\d+)/i)?.[1]));
  return out;
}

export function toRawItem(sourceSlug: string, entry: FeedEntry): RawItem {
  return {
    sourceSlug,
    link: entry.link,
    title: entry.title,
    published: entry.isoDate ?? entry.pubDate,
    snippet: entry.contentSnippet ?? entry.summary,
    bodyHtml: entry.contentEncoded,
    images: imagesOf(entry),
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw Object.assign(new Error(`${url} returned ${res.status}`), { status: res.status });
  return res.text();
}

/** One retry, for timeouts, network errors and 5xx. A 4xx is the feed's answer, not a blip. */
export async function fetchFeed(sourceSlug: string, feedUrl: string): Promise<RawItem[]> {
  let xml: string;
  try {
    xml = await fetchText(feedUrl);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== undefined && status < 500) throw error;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    xml = await fetchText(feedUrl);
  }
  return parseFeed(sourceSlug, xml);
}

export async function parseFeed(sourceSlug: string, xml: string): Promise<RawItem[]> {
  const feed = await parser.parseString(xml);
  return feed.items.map((entry) => toRawItem(sourceSlug, entry));
}

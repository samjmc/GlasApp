/**
 * Read one feed. RSS 2.0 and Atom both arrive through rss-parser.
 */
import Parser from 'rss-parser';
import type { RawItem } from './normalize';

type MediaNode = { $?: { url?: string; medium?: string; type?: string } };
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

const parser: Parser<Record<string, unknown>, FeedEntry> = new Parser({
  timeout: 15_000,
  headers: { 'User-Agent': 'GlasPoliticsBot/1.0 (+https://glaspolitics.ie)' },
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

/** First image the entry offers: media:content, then enclosure, then thumbnail, then Atom link. */
export function imageOf(entry: FeedEntry): string | undefined {
  const media = entry.mediaContent?.find((m) => m.$?.url && isImage(m.$.type, m.$.medium));
  if (media?.$?.url) return media.$.url;
  if (entry.enclosure?.url && isImage(entry.enclosure.type)) return entry.enclosure.url;
  const thumb = entry.mediaThumbnail?.find((m) => m.$?.url);
  if (thumb?.$?.url) return thumb.$.url;
  const atom = entry.links?.find((l) => l.$?.rel === 'enclosure' && l.$.href && isImage(l.$.type));
  return atom?.$?.href;
}

export function toRawItem(sourceSlug: string, entry: FeedEntry): RawItem {
  return {
    sourceSlug,
    link: entry.link,
    title: entry.title,
    published: entry.isoDate ?? entry.pubDate,
    snippet: entry.contentSnippet ?? entry.summary,
    bodyHtml: entry.contentEncoded,
    imageUrl: imageOf(entry),
  };
}

export async function fetchFeed(sourceSlug: string, feedUrl: string): Promise<RawItem[]> {
  const feed = await parser.parseURL(feedUrl);
  return feed.items.map((entry) => toRawItem(sourceSlug, entry));
}

/** For tests: parse a feed document without the network. */
export async function parseFeed(sourceSlug: string, xml: string): Promise<RawItem[]> {
  const feed = await parser.parseString(xml);
  return feed.items.map((entry) => toRawItem(sourceSlug, entry));
}

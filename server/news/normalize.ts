/**
 * Feed item -> article row. Pure.
 */
import { rankFeedImages, type ImageCandidate } from './images';

/** What a fetcher returns for one feed entry, before any cleaning. */
export interface RawItem {
  sourceSlug: string;
  link: string | undefined;
  title: string | undefined;
  /** ISO or RFC-822 date string. */
  published: string | undefined;
  /** Plain-text standfirst (rss-parser's contentSnippet / Atom summary). */
  snippet: string | undefined;
  /** Full HTML body when the feed carries one (content:encoded). */
  bodyHtml: string | undefined;
  images: ImageCandidate[];
}

export interface NewArticle {
  sourceSlug: string;
  url: string;
  title: string;
  summary: string | null;
  content: string;
  /** Chosen at ingest from `images` (plus the page's og:image when those are not enough). */
  imageUrl: string | null;
  /** Feed image candidates, upgraded and widest first. */
  images: ImageCandidate[];
  publishedAt: Date;
}

export const SUMMARY_MAX_CHARS = 600;
/** Items older than this at ingest time are not stored. */
export const MAX_ITEM_AGE_HOURS = 48;

/** Drop query string, fragment and trailing slash; lower-case the host. */
export function canonicalUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.search = '';
    const s = u.toString();
    return s.endsWith('/') && u.pathname !== '/' ? s.slice(0, -1) : s;
  } catch {
    return null;
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;|&rsquo;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cut at the last sentence end inside `max`, or at a word boundary with an ellipsis. */
export function cutSummary(text: string, max = SUMMARY_MAX_CHARS): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const window = t.slice(0, max);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
  if (sentenceEnd > max / 2) return window.slice(0, sentenceEnd + 1);
  const space = window.lastIndexOf(' ');
  return `${window.slice(0, space > 0 ? space : max)}…`;
}

/** WordPress feeds append "The post X appeared first on Y." to every description. */
function dropBoilerplate(text: string): string {
  return text.replace(/\s*The post .+ appeared first on .+\.?$/i, '').trim();
}

/**
 * A standfirst worth showing: at least MIN_SUMMARY_WORDS words. Feeds sometimes send junk here
 * (the Irish Times sent the single letter "v" on 2026-09-23), which then reached the vote card.
 */
export const MIN_SUMMARY_WORDS = 3;
export function isUsableSummary(text: string): boolean {
  return text.trim().split(/\s+/).filter((w) => /[a-z0-9À-ɏ]/i.test(w)).length >= MIN_SUMMARY_WORDS;
}

export type NormalizeResult = { ok: true; article: NewArticle } | { ok: false; reason: string };

export function normalizeItem(item: RawItem, now: Date): NormalizeResult {
  const url = item.link ? canonicalUrl(item.link) : null;
  if (!url) return { ok: false, reason: 'no usable link' };

  const title = item.title ? stripHtml(item.title) : '';
  if (!title) return { ok: false, reason: 'no title' };

  const published = item.published ? new Date(item.published) : null;
  if (!published || Number.isNaN(published.getTime())) return { ok: false, reason: 'no usable date' };
  if (now.getTime() - published.getTime() > MAX_ITEM_AGE_HOURS * 3_600_000) return { ok: false, reason: 'too old' };

  const snippet = item.snippet ? dropBoilerplate(stripHtml(item.snippet)) : '';
  const body = item.bodyHtml ? stripHtml(item.bodyHtml) : '';
  const images = rankFeedImages(item.images);

  return {
    ok: true,
    article: {
      sourceSlug: item.sourceSlug,
      url,
      title,
      summary: isUsableSummary(snippet) ? cutSummary(snippet) : null,
      content: body || snippet,
      images,
      // The best feed image, until ingest checks it and maybe finds a better one on the page.
      imageUrl: images[0]?.url ?? null,
      // A future date is a publisher clock error; clamp so it cannot pin the top of "recent".
      publishedAt: published > now ? now : published,
    },
  };
}

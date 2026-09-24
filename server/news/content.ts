/**
 * Fetch a publisher page. Used for full article bodies (scoring) and for manual adds.
 */
import * as cheerio from 'cheerio';
import { cleanImageUrl } from './images';

const TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; GlasPoliticsBot/1.0; +https://glaspolitics.ie)';
const BODY_SELECTORS = ['[itemprop="articleBody"]', 'article', '.article-content', '.article-body', '.story-content', '.entry-content', '.gh-content', 'main'];

export interface PageMeta {
  title: string | null;
  summary: string | null;
  imageUrl: string | null;
  /** og:image:width when the page states it. */
  imageWidth: number | null;
  publishedAt: Date | null;
  body: string;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

/** Pure: extract metadata and body text from a page. `pageUrl` resolves relative image URLs. */
export function parsePage(html: string, pageUrl?: string): PageMeta {
  const $ = cheerio.load(html);
  const meta = (name: string) =>
    $(`meta[property="${name}"]`).attr('content')?.trim() || $(`meta[name="${name}"]`).attr('content')?.trim() || null;

  $('script, style, nav, header, footer, aside, form, .advertisement, .ad, .social-share, .comments').remove();
  let body = '';
  for (const selector of BODY_SELECTORS) {
    const el = $(selector).first();
    if (el.length) {
      body = el.text();
      break;
    }
  }
  const published = meta('article:published_time');
  const publishedAt = published ? new Date(published) : null;
  const image = meta('og:image:secure_url') ?? meta('og:image') ?? meta('og:image:url') ?? meta('twitter:image') ?? meta('twitter:image:src');
  const imageWidth = Number(meta('og:image:width'));

  return {
    title: meta('og:title') ?? ($('title').first().text().trim() || null),
    summary: meta('og:description') ?? meta('description'),
    imageUrl: cleanImageUrl(image, pageUrl),
    imageWidth: Number.isInteger(imageWidth) && imageWidth > 0 ? imageWidth : null,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    body: (body || $('body').text()).replace(/\s+/g, ' ').trim(),
  };
}

export async function fetchPage(url: string): Promise<PageMeta> {
  return parsePage(await fetchHtml(url), url);
}

/** Full body text, or '' when the page cannot be fetched. Scoring treats '' as "keep what we had". */
export async function scrapeArticleContent(url: string): Promise<string> {
  try {
    return (await fetchPage(url)).body;
  } catch (error) {
    console.warn(`Could not fetch ${url}:`, error instanceof Error ? error.message : error);
    return '';
  }
}

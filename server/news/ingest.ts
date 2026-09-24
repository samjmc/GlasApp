/**
 * The one way articles enter the database.
 *
 *   fetch every feed at once -> normalize -> dedupe against the DB and each other
 *   -> rank what is new (relevance, category, neutral summary)
 *   -> pick a picture that loads, for the articles worth showing -> insert
 *   -> fill in pictures still missing from recent articles
 *
 * Scoring picks visible `pending` rows up later through server/scoring/articleSource.ts.
 */
import { fetchPage, type PageMeta } from './content';
import { dedupe } from './dedupe';
import { candidateOrder, firstLoading, needsPageImage, type ImageCandidate } from './images';
import { MAX_ITEM_AGE_HOURS, canonicalUrl, cutSummary, normalizeItem, type NewArticle } from './normalize';
import { RELEVANCE_FLOOR, scoreRelevance, type Relevance } from './relevance';
import * as repo from './repository';
import { fetchFeed } from './rss';
import { NEWS_SOURCES, sourceForUrl, type SourceConfig } from './sources';

/** Article pages fetched at once while looking for pictures. */
export const PAGE_CONCURRENCY = 6;
/** Recent picture-less articles retried per run. */
export const IMAGE_BACKFILL_LIMIT = 30;

export interface IngestStats {
  fetched: number;
  rejected: number;
  duplicates: number;
  ranked: number;
  unranked: number;
  belowFloor: number;
  inserted: number;
  withImage: number;
  imagesBackfilled: number;
  feeds: Array<{ source: string; items: number; error?: string }>;
}

/** Run `fn` over `items`, at most `limit` at a time, keeping order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function pageOrNull(url: string): Promise<PageMeta | null> {
  try {
    return await fetchPage(url);
  } catch {
    return null;
  }
}

/**
 * The picture for one article: the feed's if it is known to be large, else the page's
 * og:image, else a smaller feed image — whichever loads first. Also returns the page body
 * when one was fetched, so scoring does not fetch the same page again.
 */
async function resolveImage(article: NewArticle): Promise<{ imageUrl: string | null; pageBody: string | null }> {
  let page: PageMeta | null = null;
  if (needsPageImage(article.images)) page = await pageOrNull(article.url);
  const pageImage: ImageCandidate | null = page?.imageUrl ? { url: page.imageUrl, width: page.imageWidth, origin: 'page' } : null;
  const chosen = await firstLoading(candidateOrder(article.images, pageImage));
  return { imageUrl: chosen?.url ?? null, pageBody: page?.body || null };
}

function toRow(a: NewArticle, sourceIds: Map<string, number>, relevance: Relevance | null) {
  const sourceId = sourceIds.get(a.sourceSlug);
  if (sourceId === undefined) throw new Error(`Unknown news source: ${a.sourceSlug}`);
  const below = relevance !== null && relevance.score < RELEVANCE_FLOOR;
  return {
    sourceId,
    url: a.url,
    title: a.title,
    summary: a.summary,
    content: a.content,
    imageUrl: a.imageUrl,
    publishedAt: a.publishedAt,
    relevanceScore: relevance?.score ?? null,
    category: relevance?.category ?? null,
    aiSummary: relevance?.summary ?? null,
    ...(below ? { status: 'skipped' as const, skipReason: `Relevance ${relevance!.score} below floor ${RELEVANCE_FLOOR}` } : {}),
  };
}

async function fetchAll(sources: readonly SourceConfig[], now: Date, stats: IngestStats): Promise<NewArticle[]> {
  const withFeeds = sources.filter((s) => s.feedUrl);
  // All at once: a run takes as long as the slowest feed, not the sum of them. One dead feed
  // is reported and skipped; it never stops the others.
  const results = await Promise.allSettled(withFeeds.map((s) => fetchFeed(s.slug, s.feedUrl!)));
  const candidates: NewArticle[] = [];
  results.forEach((result, i) => {
    const source = withFeeds[i].slug;
    if (result.status === 'rejected') {
      stats.feeds.push({ source, items: 0, error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
      return;
    }
    stats.feeds.push({ source, items: result.value.length });
    stats.fetched += result.value.length;
    for (const item of result.value) {
      const n = normalizeItem(item, now);
      if (n.ok) candidates.push(n.article);
      else stats.rejected++;
    }
  });
  return candidates;
}

/** Fetch all feeds and store every new article, ranked, with a picture where one exists. */
export async function ingest(now = new Date()): Promise<IngestStats> {
  const sourceIds = await repo.syncSources(NEWS_SOURCES);
  const stats: IngestStats = {
    fetched: 0, rejected: 0, duplicates: 0, ranked: 0, unranked: 0, belowFloor: 0, inserted: 0, withImage: 0, imagesBackfilled: 0, feeds: [],
  };

  const candidates = await fetchAll(NEWS_SOURCES, now, stats);
  const known = await repo.existingUrls(candidates.map((c) => c.url));
  const recent = await repo.recentTitles(MAX_ITEM_AGE_HOURS);
  const { fresh, duplicates } = dedupe(candidates, [...recent, ...Array.from(known, (url) => ({ url, title: '' }))]);
  stats.duplicates = duplicates.length;

  const byName = new Map(NEWS_SOURCES.map((s) => [s.slug, s.name]));
  const { results } = await scoreRelevance(fresh.map((a) => ({ title: a.title, summary: a.summary, source: byName.get(a.sourceSlug) ?? a.sourceSlug })));
  stats.ranked = results.filter((r) => r !== null).length;
  stats.unranked = results.length - stats.ranked;
  stats.belowFloor = results.filter((r) => r !== null && r.score < RELEVANCE_FLOOR).length;

  // Pictures only for articles someone will see.
  const visible = fresh.filter((_, i) => !(results[i] && results[i]!.score < RELEVANCE_FLOOR));
  const resolved = await mapLimit(visible, PAGE_CONCURRENCY, resolveImage);
  visible.forEach((a, i) => {
    a.imageUrl = resolved[i].imageUrl;
    const body = resolved[i].pageBody;
    if (body && body.length > a.content.length) a.content = body;
  });
  stats.withImage = visible.filter((a) => a.imageUrl).length;

  const ids = await repo.insertArticles(fresh.map((a, i) => toRow(a, sourceIds, results[i])));
  stats.inserted = ids.length;

  stats.imagesBackfilled = await backfillImages();
  return stats;
}

/** Retry the page's og:image for recent visible articles still without a picture. */
export async function backfillImages(): Promise<number> {
  const missing = await repo.missingImages(MAX_ITEM_AGE_HOURS, IMAGE_BACKFILL_LIMIT);
  const found = await mapLimit(missing, PAGE_CONCURRENCY, async (row) => {
    const page = await pageOrNull(row.url);
    if (!page?.imageUrl) return false;
    const chosen = await firstLoading([{ url: page.imageUrl, width: page.imageWidth, origin: 'page' }]);
    if (!chosen) return false;
    await repo.setImageIfMissing(row.id, chosen.url);
    return true;
  });
  return found.filter(Boolean).length;
}

export type AddUrlResult = { ok: true; id: number } | { ok: false; reason: 'invalid url' | 'already stored' | 'no title' };

/**
 * Store one article an admin pasted in. It is ranked for its category and summary, but never
 * hidden by the floor: a human decided it matters. The source is the configured publisher for
 * that host, or `manual`.
 */
export async function addUrl(rawUrl: string, now = new Date()): Promise<AddUrlResult> {
  const url = canonicalUrl(rawUrl);
  if (!url) return { ok: false, reason: 'invalid url' };
  if ((await repo.existingUrls([url])).size > 0) return { ok: false, reason: 'already stored' };

  const page = await fetchPage(url);
  if (!page.title) return { ok: false, reason: 'no title' };

  const sourceIds = await repo.syncSources(NEWS_SOURCES);
  const source = sourceForUrl(url);
  const image = page.imageUrl ? await firstLoading([{ url: page.imageUrl, width: page.imageWidth, origin: 'page' }]) : null;
  const article: NewArticle = {
    sourceSlug: source.slug,
    url,
    title: page.title,
    summary: page.summary ? cutSummary(page.summary) : null,
    content: page.body,
    imageUrl: image?.url ?? null,
    images: [],
    publishedAt: page.publishedAt && page.publishedAt <= now ? page.publishedAt : now,
  };
  const { results } = await scoreRelevance([{ title: article.title, summary: article.summary, source: source.name }]).catch(() => ({ results: [null] }));
  const relevance = results[0] ? { ...results[0], score: Math.max(results[0].score, RELEVANCE_FLOOR) } : null;
  const [id] = await repo.insertArticles([toRow(article, sourceIds, relevance)]);
  return id === undefined ? { ok: false, reason: 'already stored' } : { ok: true, id };
}

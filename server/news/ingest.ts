/**
 * The one way articles enter the database.
 *
 *   fetch every feed at once -> normalize -> drop known URLs, link title copies
 *   -> rank what is new (relevance, category, neutral summary)
 *   -> link same-event items to the earliest report (events.ts)
 *   -> pick a picture that loads, for the canonicals worth showing
 *   -> insert canonicals, then their duplicates -> fill in pictures still missing
 *
 * The TD pipeline picks visible `pending` rows up later through server/news/articleSource.ts.
 * Duplicates are stored as `duplicate` with `duplicate_of`, so they are never shown or processed.
 */
import { fetchPage, type PageMeta } from './content';
import { dedupe } from './dedupe';
import { EVENT_CANDIDATE_LIMIT, EVENT_WINDOW_HOURS, assignCanonicals, matchEvents, type Link } from './events';
import { candidateOrder, firstLoading, needsPageImage, type ImageCandidate } from './images';
import { MAX_ITEM_AGE_HOURS, canonicalUrl, cutSummary, normalizeItem, type NewArticle } from './normalize';
import { RELEVANCE_FLOOR, scoreRelevance, type Relevance } from './relevance';
import * as repo from './repository';
import type { NewNewsArticle } from '@shared/schema/news';
import { fetchFeed } from './rss';
import { NEWS_SOURCES, sourceForUrl, type SourceConfig } from './sources';

/** Article pages fetched at once while looking for pictures. */
export const PAGE_CONCURRENCY = 6;
/** Recent picture-less articles retried per run. */
export const IMAGE_BACKFILL_LIMIT = 30;

export interface IngestStats {
  fetched: number;
  rejected: number;
  /** Not stored: the URL was stored already, or repeated in this run. */
  knownUrls: number;
  /** Stored as a duplicate of an earlier article about the same event. */
  duplicates: number;
  /** Event-match calls that failed; their items were stored as their own canonicals. */
  eventMatchFailed: number;
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

let running: Promise<IngestStats> | null = null;

/**
 * Fetch all feeds and store every new article, ranked, with a picture where one exists.
 * One run at a time: a call made while a run is in flight gets that run's result, so two
 * runs can never both store the same event as a canonical. Every caller is in this process.
 */
export function ingest(now = new Date()): Promise<IngestStats> {
  if (!running) running = runIngest(now).finally(() => (running = null));
  return running;
}

async function runIngest(now: Date): Promise<IngestStats> {
  const sourceIds = await repo.syncSources(NEWS_SOURCES);
  const stats: IngestStats = {
    fetched: 0, rejected: 0, knownUrls: 0, duplicates: 0, eventMatchFailed: 0, ranked: 0, unranked: 0, belowFloor: 0, inserted: 0, withImage: 0, imagesBackfilled: 0, feeds: [],
  };

  const candidates = await fetchAll(NEWS_SOURCES, now, stats);
  const known = await repo.existingUrls(candidates.map((c) => c.url));
  const recent = await repo.recentTitles(MAX_ITEM_AGE_HOURS);
  const { fresh, links: titleLinks, knownUrls } = dedupe(candidates, recent, known);
  stats.knownUrls = knownUrls;

  const byName = new Map(NEWS_SOURCES.map((s) => [s.slug, s.name]));
  const { results } = await scoreRelevance(fresh.map((a) => ({ title: a.title, summary: a.summary, source: byName.get(a.sourceSlug) ?? a.sourceSlug })));
  stats.ranked = results.filter((r) => r !== null).length;
  stats.unranked = results.length - stats.ranked;
  stats.belowFloor = results.filter((r) => r !== null && r.score < RELEVANCE_FLOOR).length;
  const below = (i: number) => results[i] !== null && results[i]!.score < RELEVANCE_FLOOR;

  // Title copies are linked already; every other item someone would see goes to the event match.
  const titleLinked = new Set(titleLinks.map((l) => l.index));
  const eventItems = fresh
    .map((a, index) => ({ index, title: a.title, summary: results[index]?.summary ?? null }))
    .filter(({ index }) => !titleLinked.has(index) && !below(index));
  let eventLinks: Array<{ index: number; of: Link }> = [];
  if (eventItems.length > 0) {
    const match = await matchEvents(eventItems, await repo.eventCandidates(now, EVENT_WINDOW_HOURS, EVENT_CANDIDATE_LIMIT));
    eventLinks = match.links;
    stats.eventMatchFailed = match.failedCalls;
  }
  const canonicalOf = assignCanonicals(fresh, titleLinks.concat(eventLinks));

  // Pictures only for articles someone will see.
  const visible = fresh.filter((_, i) => canonicalOf[i] === null && !below(i));
  const resolved = await mapLimit(visible, PAGE_CONCURRENCY, resolveImage);
  visible.forEach((a, i) => {
    a.imageUrl = resolved[i].imageUrl;
    const body = resolved[i].pageBody;
    if (body && body.length > a.content.length) a.content = body;
  });
  stats.withImage = visible.filter((a) => a.imageUrl).length;

  const rows = fresh.map((a, i) => toRow(a, sourceIds, results[i]));
  const inserted = await repo.insertArticles(rows.filter((_, i) => canonicalOf[i] === null));
  const idByUrl = new Map(inserted.map((r) => [r.url, r.id]));
  const copies: NewNewsArticle[] = rows.flatMap((row, i) => {
    const of = canonicalOf[i];
    if (of === null) return [];
    const duplicateOf = 'stored' in of ? of.stored : idByUrl.get(fresh[of.run].url);
    // Undefined only when the canonical lost a URL race to another writer: this copy stands alone.
    return [duplicateOf === undefined ? row : { ...row, status: 'duplicate' as const, duplicateOf }];
  });
  stats.inserted = inserted.length + (await repo.insertArticles(copies)).length;
  stats.duplicates = copies.filter((c) => c.duplicateOf != null).length;

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

export type AddUrlResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'invalid url' | 'already stored' | 'no title' }
  | { ok: false; reason: 'same event'; of: number };

/**
 * Store one article an admin pasted in. It is ranked for its category and summary, but never
 * hidden by the floor: a human decided it matters. The source is the configured publisher for
 * that host, or `manual`. An article about an event already shown is refused unless `force`,
 * and a forced add is its own canonical.
 */
export async function addUrl(rawUrl: string, { force = false }: { force?: boolean } = {}, now = new Date()): Promise<AddUrlResult> {
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
  if (!force) {
    const candidates = await repo.eventCandidates(now, EVENT_WINDOW_HOURS, EVENT_CANDIDATE_LIMIT);
    const { links } = await matchEvents([{ index: 0, title: article.title, summary: relevance?.summary ?? null }], candidates);
    const of = links[0]?.of;
    if (of && 'stored' in of) return { ok: false, reason: 'same event', of: of.stored };
  }
  const [row] = await repo.insertArticles([toRow(article, sourceIds, relevance)]);
  return row === undefined ? { ok: false, reason: 'already stored' } : { ok: true, id: row.id };
}

/**
 * The one way articles enter the database.
 *
 *   fetch every feed -> normalize -> dedupe against the DB and each other
 *   -> classify only what is new -> insert as `pending`
 *
 * Scoring picks `pending` rows up later through server/scoring/articleSource.ts.
 */
import { classify } from './classify';
import { fetchPage } from './content';
import { dedupe } from './dedupe';
import { MAX_ITEM_AGE_HOURS, canonicalUrl, cutSummary, normalizeItem, type NewArticle } from './normalize';
import * as repo from './repository';
import { fetchFeed } from './rss';
import { NEWS_SOURCES, sourceForUrl } from './sources';

export interface IngestStats {
  fetched: number;
  rejected: number;
  duplicates: number;
  classified: number;
  notPolitical: number;
  inserted: number;
  feedErrors: Array<{ source: string; error: string }>;
}

/** Fetch all feeds and store every new political article. */
export async function ingest(now = new Date()): Promise<IngestStats> {
  const sourceIds = await repo.syncSources(NEWS_SOURCES);
  const stats: IngestStats = { fetched: 0, rejected: 0, duplicates: 0, classified: 0, notPolitical: 0, inserted: 0, feedErrors: [] };

  const candidates: NewArticle[] = [];
  for (const source of NEWS_SOURCES) {
    if (!source.feedUrl) continue;
    try {
      const items = await fetchFeed(source.slug, source.feedUrl);
      stats.fetched += items.length;
      for (const item of items) {
        const result = normalizeItem(item, now);
        if (result.ok) candidates.push(result.article);
        else stats.rejected++;
      }
    } catch (error) {
      // One dead feed must not stop the others.
      stats.feedErrors.push({ source: source.slug, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const known = await repo.existingUrls(candidates.map((c) => c.url));
  const recent = await repo.recentTitles(MAX_ITEM_AGE_HOURS);
  const { fresh, duplicates } = dedupe(
    candidates,
    [...recent, ...Array.from(known, (url) => ({ url, title: '' }))],
  );
  stats.duplicates = duplicates.length;

  const byName = new Map(NEWS_SOURCES.map((s) => [s.slug, s.name]));
  const verdicts = await classify(fresh.map((a) => ({ title: a.title, summary: a.summary, source: byName.get(a.sourceSlug) ?? a.sourceSlug })));
  stats.classified = verdicts.length;
  const political = fresh.filter((_, i) => verdicts[i].political);
  stats.notPolitical = fresh.length - political.length;

  const ids = await repo.insertArticles(political.map((a) => toRow(a, sourceIds)));
  stats.inserted = ids.length;
  return stats;
}

export type AddUrlResult = { ok: true; id: number } | { ok: false; reason: 'invalid url' | 'already stored' | 'no title' };

/**
 * Store one article an admin pasted in. Skips classification: a human decided it matters.
 * The source is the configured publisher for that host, or `manual`.
 */
export async function addUrl(rawUrl: string, now = new Date()): Promise<AddUrlResult> {
  const url = canonicalUrl(rawUrl);
  if (!url) return { ok: false, reason: 'invalid url' };
  if ((await repo.existingUrls([url])).size > 0) return { ok: false, reason: 'already stored' };

  const page = await fetchPage(url);
  if (!page.title) return { ok: false, reason: 'no title' };

  const sourceIds = await repo.syncSources(NEWS_SOURCES);
  const article: NewArticle = {
    sourceSlug: sourceForUrl(url).slug,
    url,
    title: page.title,
    summary: page.summary ? cutSummary(page.summary) : null,
    content: page.body,
    imageUrl: page.imageUrl,
    publishedAt: page.publishedAt && page.publishedAt <= now ? page.publishedAt : now,
  };
  const [id] = await repo.insertArticles([toRow(article, sourceIds)]);
  return id === undefined ? { ok: false, reason: 'already stored' } : { ok: true, id };
}

function toRow(a: NewArticle, sourceIds: Map<string, number>) {
  const sourceId = sourceIds.get(a.sourceSlug);
  if (sourceId === undefined) throw new Error(`Unknown news source: ${a.sourceSlug}`);
  return {
    sourceId,
    url: a.url,
    title: a.title,
    summary: a.summary,
    content: a.content,
    imageUrl: a.imageUrl,
    publishedAt: a.publishedAt,
  };
}

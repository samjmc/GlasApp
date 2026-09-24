/**
 * Every read and write of the news tables. Nothing else touches them.
 */
import { and, desc, eq, gte, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import { db, type Db } from '../db';
import { newsArticles, newsSources, type ArticleStatus, type NewNewsArticle } from '@shared/schema/news';
import type { SourceConfig } from './sources';
import type { FeedQuery } from './feed';

/** A claim older than this is presumed dead (crash, deploy) and may be taken again. */
export const CLAIM_LEASE_HOURS = 6;
/** A row claimed this many times without finishing is marked failed. */
export const MAX_ATTEMPTS = 3;
/** Pending rows older than this are not worth scoring. */
export const MAX_SCORING_AGE_DAYS = 7;

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Upsert the configured sources; returns slug -> id. */
export async function syncSources(sources: readonly SourceConfig[], database: Db = db): Promise<Map<string, number>> {
  const rows = await database
    .insert(newsSources)
    .values(sources.map((s) => ({ ...s, enabled: true })))
    .onConflictDoUpdate({
      target: newsSources.slug,
      set: {
        name: sql`excluded.name`,
        homepageUrl: sql`excluded.homepage_url`,
        feedUrl: sql`excluded.feed_url`,
        logoUrl: sql`excluded.logo_url`,
        credibility: sql`excluded.credibility`,
        enabled: sql`true`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: newsSources.id, slug: newsSources.slug });

  // A source removed from the code stays in the table (articles reference it) but stops fetching.
  await database
    .update(newsSources)
    .set({ enabled: false, updatedAt: sql`now()` })
    .where(notInArray(newsSources.slug, sources.map((s) => s.slug)));

  return new Map(rows.map((r) => [r.slug, r.id]));
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

/** Which of these URLs are already stored. */
export async function existingUrls(urls: string[], database: Db = db): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const rows = await database.select({ url: newsArticles.url }).from(newsArticles).where(inArray(newsArticles.url, urls));
  return new Set(rows.map((r) => r.url));
}

/** Titles stored in the last `hours`, for title-similarity dedup. */
export async function recentTitles(hours: number, database: Db = db): Promise<Array<{ url: string; title: string }>> {
  return database
    .select({ url: newsArticles.url, title: newsArticles.title })
    .from(newsArticles)
    .where(gte(newsArticles.createdAt, sql`now() - make_interval(hours => ${hours})`))
    .orderBy(desc(newsArticles.createdAt))
    .limit(1000);
}

/** Insert new articles. A URL already present is left exactly as it is. Returns ids inserted. */
export async function insertArticles(rows: NewNewsArticle[], database: Db = db): Promise<number[]> {
  if (rows.length === 0) return [];
  const inserted = await database
    .insert(newsArticles)
    .values(rows)
    .onConflictDoNothing({ target: newsArticles.url })
    .returning({ id: newsArticles.id });
  return inserted.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Scoring handoff
// ---------------------------------------------------------------------------

export interface ClaimedArticle {
  id: number;
  title: string;
  summary: string | null;
  content: string;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  sourceName: string;
  credibility: number;
}

const claimedColumns = {
  id: newsArticles.id,
  title: newsArticles.title,
  summary: newsArticles.summary,
  content: newsArticles.content,
  url: newsArticles.url,
  imageUrl: newsArticles.imageUrl,
  publishedAt: newsArticles.publishedAt,
  sourceName: newsSources.name,
  credibility: newsSources.credibility,
};

/**
 * Atomically take up to `limit` articles for one scoring run, newest first.
 *
 * `FOR UPDATE SKIP LOCKED` means two concurrent runs always get disjoint rows, so an article
 * can never be scored (and its ELO applied) twice. A claim older than the lease is taken
 * again; after MAX_ATTEMPTS it is marked failed instead, so a poison article cannot loop.
 */
export async function claimForScoring(limit: number, database: Db = db): Promise<ClaimedArticle[]> {
  const lease = sql`now() - make_interval(hours => ${CLAIM_LEASE_HOURS})`;
  const maxAge = sql`now() - make_interval(days => ${MAX_SCORING_AGE_DAYS})`;

  await database
    .update(newsArticles)
    .set({ status: 'skipped', skipReason: `Older than ${MAX_SCORING_AGE_DAYS} days when first claimed`, updatedAt: sql`now()` })
    .where(and(eq(newsArticles.status, 'pending'), sql`${newsArticles.publishedAt} < ${maxAge}`));
  await database
    .update(newsArticles)
    .set({ status: 'failed', errorMessage: `Claim expired ${MAX_ATTEMPTS} times without finishing`, updatedAt: sql`now()` })
    .where(and(eq(newsArticles.status, 'claimed'), sql`${newsArticles.claimedAt} < ${lease}`, gte(newsArticles.attempts, MAX_ATTEMPTS)));

  const claimed = await database.execute<{ id: number }>(sql`
    update ${newsArticles}
       set status = 'claimed', claimed_at = now(), attempts = attempts + 1, updated_at = now()
     where id in (
       select id from ${newsArticles}
        where (status = 'pending' and published_at >= ${maxAge})
           or (status = 'claimed' and claimed_at < ${lease} and attempts < ${MAX_ATTEMPTS})
        order by published_at desc
        limit ${limit}
        for update skip locked)
    returning id`);
  const ids = claimed.rows.map((r) => Number(r.id));
  if (ids.length === 0) return [];

  return database
    .select(claimedColumns)
    .from(newsArticles)
    .innerJoin(newsSources, eq(newsSources.id, newsArticles.sourceId))
    .where(inArray(newsArticles.id, ids))
    .orderBy(desc(newsArticles.publishedAt));
}

export async function findForScoring(id: number, database: Db = db): Promise<ClaimedArticle | null> {
  const rows = await database
    .select(claimedColumns)
    .from(newsArticles)
    .innerJoin(newsSources, eq(newsSources.id, newsArticles.sourceId))
    .where(eq(newsArticles.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveContent(id: number, content: string, database: Db = db): Promise<void> {
  await database.update(newsArticles).set({ content, updatedAt: sql`now()` }).where(eq(newsArticles.id, id));
}

export interface Outcome {
  status: Extract<ArticleStatus, 'scored' | 'skipped' | 'failed'>;
  importanceScore: number | null;
  importanceReasoning: string | null;
  skipReason: string | null;
  errorMessage: string | null;
}

export async function markOutcome(id: number, outcome: Outcome, database: Db = db): Promise<void> {
  await database
    .update(newsArticles)
    .set({
      status: outcome.status,
      importanceScore: outcome.importanceScore === null ? null : Math.round(outcome.importanceScore),
      importanceReasoning: outcome.importanceReasoning,
      skipReason: outcome.skipReason,
      errorMessage: outcome.errorMessage,
      updatedAt: sql`now()`,
    })
    .where(eq(newsArticles.id, id));
}

export async function statusCounts(database: Db = db): Promise<Record<ArticleStatus, number>> {
  const rows = await database
    .select({ status: newsArticles.status, n: sql<number>`count(*)::int` })
    .from(newsArticles)
    .groupBy(newsArticles.status);
  const out: Record<ArticleStatus, number> = { pending: 0, claimed: 0, scored: 0, skipped: 0, failed: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export interface FeedRow {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  source: string;
  sourceLogoUrl: string | null;
  /** The strongest verdict on any TD in this article, −10..+10. NULL when no TD was scored. */
  impact: number | null;
  storyType: string | null;
  sentiment: string | null;
  affectedTds: Array<{ name: string; impactScore: number }>;
}

type RawFeedRow = {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  published_at: Date | string;
  source: string;
  source_logo_url: string | null;
  impact: number | string | null;
  story_type: string | null;
  sentiment: string | null;
  affected: Array<{ name: string; impactScore: number }> | null;
};

function toFeedRow(r: RawFeedRow): FeedRow {
  return {
    id: Number(r.id),
    title: r.title,
    summary: r.summary,
    url: r.url,
    imageUrl: r.image_url,
    publishedAt: new Date(r.published_at),
    source: r.source,
    sourceLogoUrl: r.source_logo_url,
    impact: r.impact === null ? null : Number(r.impact),
    storyType: r.story_type,
    sentiment: r.sentiment,
    affectedTds: r.affected ?? [],
  };
}

/** The feed's SELECT, with the strongest verdict and every affected TD per article. */
function feedSelect(where: SQL, orderBy: SQL, limit: number, offset: number): SQL {
  return sql`
    select a.id, a.title, a.summary, a.url, a.image_url, a.published_at,
           s.name as source, s.logo_url as source_logo_url,
           top.impact, top.story_type, top.sentiment, aff.affected
      from politics.news_articles a
      join politics.news_sources s on s.id = a.source_id
      left join lateral (
        select v.impact, v.story_type, v.sentiment
          from politics.article_td_scores v
         where v.article_id = a.id
         order by abs(v.impact) desc
         limit 1) top on true
      left join lateral (
        select json_agg(json_build_object('name', t.name, 'impactScore', v.impact) order by abs(v.impact) desc) as affected
          from politics.article_td_scores v
          join politics.tds t on t.id = v.td_id
         where v.article_id = a.id) aff on true
     where ${where}
     order by ${orderBy}
     limit ${limit} offset ${offset}`;
}

const BY_IMPACT = sql`(top.impact is null), abs(top.impact) desc, a.published_at desc, a.id desc`;
const BY_DATE = sql`a.published_at desc, a.id desc`;

async function page(where: SQL, orderBy: SQL, limit: number, offset: number, database: Db) {
  const [rows, count] = await Promise.all([
    database.execute<RawFeedRow>(feedSelect(where, orderBy, limit, offset)),
    database.execute<{ n: number }>(sql`select count(*)::int as n from politics.news_articles a where ${where}`),
  ]);
  return { rows: rows.rows.map(toFeedRow), total: Number(count.rows[0]?.n ?? 0) };
}

/**
 * One feed page. `today` is the highest-impact articles since local midnight, falling back to
 * the last `fallbackDays` when nothing was published today.
 */
export async function feedPage(
  query: FeedQuery,
  window: { since: Date; fallbackDays: number },
  database: Db = db,
): Promise<{ rows: FeedRow[]; total: number }> {
  const everything = sql`true`;
  if (query.sort === 'recent') return page(everything, BY_DATE, query.limit, query.offset, database);
  if (query.sort === 'score') return page(everything, BY_IMPACT, query.limit, query.offset, database);

  const today = await page(sql`a.published_at >= ${window.since}`, BY_IMPACT, query.limit, query.offset, database);
  if (today.total > 0) return today;
  return page(
    sql`a.published_at >= now() - make_interval(days => ${window.fallbackDays})`,
    BY_IMPACT,
    query.limit,
    query.offset,
    database,
  );
}

/** Newest articles, optionally only those whose title, summary or body mention `topic`. */
export async function searchRecent(topic: string | undefined, limit: number, database: Db = db): Promise<FeedRow[]> {
  const pattern = topic ? `%${topic.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const where = pattern ? sql`(a.title ilike ${pattern} or a.summary ilike ${pattern} or a.content ilike ${pattern})` : sql`true`;
  return (await page(where, BY_DATE, limit, 0, database)).rows;
}

/** Newest articles in which the named TD was scored. */
export async function feedForTd(name: string, limit: number, database: Db = db): Promise<FeedRow[]> {
  const where = sql`exists (
    select 1 from politics.article_td_scores v join politics.tds t on t.id = v.td_id
     where v.article_id = a.id and lower(t.name) = lower(${name.trim()}))`;
  return (await page(where, BY_DATE, limit, 0, database)).rows;
}

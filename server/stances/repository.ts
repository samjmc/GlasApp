/**
 * Every read and write of `politics.td_stances`. Nothing else touches it.
 */
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import { tds } from '@shared/schema/politics';
import { tdStances, type TdStanceRow } from '@shared/schema/stances';
import type { QuoteKind } from '@shared/stancesApi';
import type { PolicyDomain } from '../constants/policyTopics';

export interface StanceInput {
  tdId: number;
  questionId: number | null;
  optionKey: string | null;
  optionText: string | null;
  quote: string;
  quoteKind: QuoteKind;
  policyDomain: PolicyDomain;
}

/**
 * Save one article's stances. The url, outlet, headline and date are copied from the article
 * in the same statement, so they are always the canonical's own. A duplicate article saves
 * nothing: stances are kept once per event. A re-run of the same article replaces its rows.
 * Returns the TD and `stated_at` of each saved row.
 */
export async function saveStances(
  articleId: number,
  stances: StanceInput[],
  database: Db = db,
): Promise<Array<{ tdId: number; statedAt: Date }>> {
  if (stances.length === 0) return [];
  const values = sql.join(
    stances.map(
      (s) =>
        sql`(${s.tdId}::int, ${s.questionId}::int, ${s.optionKey}::varchar, ${s.optionText}::text, ${s.quote}::text, ${s.quoteKind}::varchar, ${s.policyDomain}::varchar)`,
    ),
    sql`, `,
  );
  const result = await database.execute<{ td_id: number; stated_at: Date | string }>(sql`
    insert into politics.td_stances
      (td_id, article_id, question_id, option_key, option_text, quote, quote_kind, policy_domain,
       stated_at, article_url, source_name, headline)
    select v.td_id, a.id, v.question_id, v.option_key, v.option_text, v.quote, v.quote_kind, v.policy_domain,
           coalesce(a.published_at, a.created_at), a.url, s.name, a.title
      from (values ${values}) as v (td_id, question_id, option_key, option_text, quote, quote_kind, policy_domain)
      join politics.news_articles a on a.id = ${articleId} and a.status <> 'duplicate'
      join politics.news_sources s on s.id = a.source_id
    on conflict (td_id, article_id) do update set
      question_id = excluded.question_id, option_key = excluded.option_key, option_text = excluded.option_text,
      quote = excluded.quote, quote_kind = excluded.quote_kind, policy_domain = excluded.policy_domain,
      stated_at = excluded.stated_at, article_url = excluded.article_url, source_name = excluded.source_name,
      headline = excluded.headline
    returning td_id, stated_at`);
  return result.rows.map((r) => ({ tdId: Number(r.td_id), statedAt: new Date(r.stated_at) }));
}

/** Most stances one TD page lists. */
export const TD_STANCE_LIMIT = 200;

/** A TD's stances, newest first. */
export async function stancesForTd(tdId: number, database: Db = db): Promise<TdStanceRow[]> {
  return database
    .select()
    .from(tdStances)
    .where(eq(tdStances.tdId, tdId))
    .orderBy(desc(tdStances.statedAt), desc(tdStances.id))
    .limit(TD_STANCE_LIMIT);
}

export async function tdExists(tdId: number, database: Db = db): Promise<boolean> {
  const rows = await database.select({ id: tds.id }).from(tds).where(eq(tds.id, tdId)).limit(1);
  return rows.length > 0;
}

export type MappedStance = TdStanceRow & { questionId: number; optionKey: string };

/** Every TD's stances on these questions that chose an option. */
export async function mappedStancesOn(questionIds: number[], database: Db = db): Promise<MappedStance[]> {
  if (questionIds.length === 0) return [];
  const rows = await database
    .select()
    .from(tdStances)
    .where(and(inArray(tdStances.questionId, questionIds), isNotNull(tdStances.optionKey)));
  return rows as MappedStance[];
}

export interface RebuildArticle {
  id: number;
  title: string;
  content: string;
  /** The TDs `article_tds` links to the article. */
  tds: Array<{ id: number; name: string; party: string | null; offices: Array<{ title: string }> | null }>;
}

/**
 * What `npm run stances -- --rebuild` re-reads: canonical articles published since `since` that
 * ALREADY have a daily-vote question and name at least one TD, oldest first. It never makes a
 * question: a new one would carry today's date and flood the daily sessions.
 */
export async function rebuildArticles(since: Date, database: Db = db): Promise<RebuildArticle[]> {
  const result = await database.execute<{ id: number; title: string; content: string; tds: RebuildArticle['tds'] }>(sql`
    select a.id, a.title, a.content,
           json_agg(json_build_object('id', t.id, 'name', t.name, 'party', t.party, 'offices', t.offices) order by t.id) as tds
      from politics.news_articles a
      join politics.article_tds v on v.article_id = a.id
      join politics.tds t on t.id = v.td_id
     where a.status <> 'duplicate'
       and a.published_at >= ${since}
       and exists (select 1 from politics.policy_questions q where q.article_id = a.id)
     group by a.id
     order by a.published_at, a.id`);
  return result.rows.map((r) => ({ ...r, id: Number(r.id) }));
}

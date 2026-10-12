/**
 * Every read and write of `politics.td_stances` and `politics.division_readings`. Nothing else
 * touches them. Also the one write of `stance` evidence rows by TD (replaceStanceEvidenceOf),
 * which must share the stance transaction.
 */
import { and, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import { tds } from '@shared/schema/politics';
import { tdIdeologyEvidence, type NewTdIdeologyEvidence } from '@shared/schema/quiz';
import { divisionReadings, tdStances, type DivisionReadingRow, type NewDivisionReading, type NewTdStance, type TdStanceRow } from '@shared/schema/stances';
import type { QuoteKind } from '@shared/stancesApi';
import type { PolicyDomain } from '../constants/policyTopics';
import { insertStanceEvidenceRows, STANCE_SYNC_LOCK } from '../ideology/repository';
import type { StanceForEvidence } from './evidence';

/** A transaction handle, as `db.transaction` passes it. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Run `fn` in one transaction holding STANCE_SYNC_LOCK, the lock every whole-set stance write
 * takes, so a news article's stances and evidence and the nightly rebuild never interleave.
 */
export function withStanceLock<T>(fn: (tx: Tx) => Promise<T>, database: Db = db): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${STANCE_SYNC_LOCK}::bigint)`);
    return fn(tx);
  });
}

/** Delete one article's news stances of every TD not in `keep`. Returns the TDs whose rows went. */
export async function deleteArticleStancesExcept(articleId: number, keep: number[], tx: Tx): Promise<number[]> {
  const rows = await tx
    .delete(tdStances)
    .where(and(eq(tdStances.articleId, articleId), isNull(tdStances.divisionId), keep.length > 0 ? notInArray(tdStances.tdId, keep) : undefined))
    .returning({ tdId: tdStances.tdId });
  return rows.map((r) => r.tdId);
}

/**
 * Replace the `stance` evidence of these TDs (every TD when null) with `rows`. Inside a
 * withStanceLock transaction; profiles are not recomputed here.
 */
export async function replaceStanceEvidenceOf(tx: Tx, tdIds: number[] | null, rows: NewTdIdeologyEvidence[]): Promise<void> {
  if (tdIds !== null && tdIds.length === 0) return;
  const stance = eq(tdIdeologyEvidence.source, 'stance');
  await tx.delete(tdIdeologyEvidence).where(tdIds === null ? stance : and(stance, inArray(tdIdeologyEvidence.tdId, tdIds)));
  await insertStanceEvidenceRows(tx, rows);
}

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
 * nothing: stances are kept once per event. A re-run of the same article updates its rows in
 * place; deleteArticleStancesExcept removes the ones it no longer has (server/stances/record.ts).
 * Returns the TD and `stated_at` of each saved row.
 */
export async function saveStances(
  articleId: number,
  stances: StanceInput[],
  database: Pick<Db, 'execute'> = db,
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

/** Every stance with an answer (of these TDs, when given), news and Dáil votes, as the evidence rebuild reads them. */
export async function stanceRowsForEvidence(database: Pick<Db, 'select'> = db, tdIds: number[] | null = null): Promise<StanceForEvidence[]> {
  if (tdIds !== null && tdIds.length === 0) return [];
  const rows = await database
    .select({
      id: tdStances.id,
      tdId: tdStances.tdId,
      questionId: tdStances.questionId,
      optionKey: tdStances.optionKey,
      quoteKind: tdStances.quoteKind,
      discipline: tdStances.discipline,
      statedAt: tdStances.statedAt,
    })
    .from(tdStances)
    .where(and(isNotNull(tdStances.optionKey), tdIds === null ? undefined : inArray(tdStances.tdId, tdIds)));
  return rows as StanceForEvidence[];
}

const STANCE_INSERT_CHUNK = 500;

/**
 * Replace every Dáil-vote stance (`division_id` set) with `rows`, in one transaction under the
 * stance sync lock. News rows are never touched. Ids change on each sync; nothing keeps them.
 */
export async function replaceDivisionStances(rows: NewTdStance[], database: Db = db): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${STANCE_SYNC_LOCK}::bigint)`);
    await tx.delete(tdStances).where(isNotNull(tdStances.divisionId));
    for (let i = 0; i < rows.length; i += STANCE_INSERT_CHUNK) await tx.insert(tdStances).values(rows.slice(i, i + STANCE_INSERT_CHUNK));
  });
}

export async function listDivisionReadings(database: Db = db): Promise<DivisionReadingRow[]> {
  return database.select().from(divisionReadings);
}

/** One division's reading, replacing any earlier one whole. */
export async function upsertDivisionReading(row: NewDivisionReading, database: Db = db): Promise<void> {
  const { divisionId: _divisionId, ...rest } = row;
  await database.insert(divisionReadings).values(row).onConflictDoUpdate({ target: divisionReadings.divisionId, set: rest });
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

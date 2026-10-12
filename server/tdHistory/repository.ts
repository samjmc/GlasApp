/**
 * Every write of politics.td_historical_baselines. Reads for the TD page stay in
 * server/scoring/repository.ts (baselineFor, listBaselines).
 */
import { and, asc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import { tdHistoricalBaselines, tdHistorySuppressed, tds } from '@shared/schema/politics';

export interface HistoryTd {
  id: number;
  name: string;
  memberCode: string;
}

/**
 * Active TDs with a member code: the only ones that can be matched exactly (R3). A TD whose
 * background was taken down is left out, unless it is `restore` (`--force --td <id>`).
 */
export async function historyCandidates(options: { restore?: number } = {}, database: Db = db): Promise<HistoryTd[]> {
  const notSuppressed = sql`not exists (select 1 from ${tdHistorySuppressed} where ${tdHistorySuppressed.tdId} = ${tds.id})`;
  const rows = await database
    .select({ id: tds.id, name: tds.name, memberCode: tds.memberCode })
    .from(tds)
    .where(
      and(
        eq(tds.isActive, true),
        isNotNull(tds.memberCode),
        options.restore === undefined ? notSuppressed : or(notSuppressed, eq(tds.id, options.restore)),
      ),
    )
    .orderBy(asc(tds.id));
  return rows.map((r) => ({ id: r.id, name: r.name, memberCode: r.memberCode! }));
}

/** td id → the revision its stored background was checked against. */
export async function storedRevisions(database: Db = db): Promise<Map<number, number>> {
  const rows = await database
    .select({ tdId: tdHistoricalBaselines.tdId, revision: tdHistoricalBaselines.sourceRevision })
    .from(tdHistoricalBaselines);
  return new Map(rows.map((r) => [r.tdId, r.revision]));
}

export interface HistoryRow {
  tdId: number;
  summary: string;
  passages: string[];
  sourceUrl: string;
  sourceTitle: string;
  sourceRevision: number;
  retrievedAt: Date;
  model: string | null;
}

/**
 * One row per TD: a new revision replaces the old background whole. False, writing nothing, when
 * the TD's background was taken down meanwhile, unless `restore`: then the takedown is lifted.
 * Both this and deleteHistory lock the TD's row first, so a takedown during a bulk run is never undone.
 */
export async function saveHistory(row: HistoryRow, options: { restore?: boolean } = {}, database: Db = db): Promise<boolean> {
  const { tdId, ...values } = row;
  return database.transaction(async (tx) => {
    await tx.select({ id: tds.id }).from(tds).where(eq(tds.id, tdId)).for('share');
    if (options.restore) await tx.delete(tdHistorySuppressed).where(eq(tdHistorySuppressed.tdId, tdId));
    else if ((await tx.select({ tdId: tdHistorySuppressed.tdId }).from(tdHistorySuppressed).where(eq(tdHistorySuppressed.tdId, tdId))).length > 0) {
      return false;
    }
    await tx
      .insert(tdHistoricalBaselines)
      .values(row)
      .onConflictDoUpdate({ target: tdHistoricalBaselines.tdId, set: { ...values, updatedAt: sql`now()` } });
    return true;
  });
}

/**
 * Take one TD's background down at once (a complaint, a correction), and keep it down: the TD is
 * recorded in td_history_suppressed in the same transaction, so later runs skip it. True when a row went.
 */
export async function deleteHistory(tdId: number, reason: string | null = null, database: Db = db): Promise<boolean> {
  return database.transaction(async (tx) => {
    const [td] = await tx.select({ id: tds.id }).from(tds).where(eq(tds.id, tdId)).for('update');
    if (!td) throw new Error(`No TD has id ${tdId}. Nothing was changed.`);
    const rows = await tx.delete(tdHistoricalBaselines).where(eq(tdHistoricalBaselines.tdId, tdId)).returning({ id: tdHistoricalBaselines.id });
    await tx
      .insert(tdHistorySuppressed)
      .values({ tdId, reason })
      .onConflictDoUpdate({ target: tdHistorySuppressed.tdId, set: { suppressedAt: sql`now()`, reason } });
    return rows.length > 0;
  });
}

/**
 * Every write of politics.td_historical_baselines. Reads for the TD page stay in
 * server/scoring/repository.ts (baselineFor, listBaselines).
 */
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import { tdHistoricalBaselines, tds } from '@shared/schema/politics';

export interface HistoryTd {
  id: number;
  name: string;
  memberCode: string;
}

/** Active TDs with a member code: the only ones that can be matched exactly (R3). */
export async function historyCandidates(database: Db = db): Promise<HistoryTd[]> {
  const rows = await database
    .select({ id: tds.id, name: tds.name, memberCode: tds.memberCode })
    .from(tds)
    .where(and(eq(tds.isActive, true), isNotNull(tds.memberCode)))
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

/** One row per TD: a new revision replaces the old background whole. */
export async function saveHistory(row: HistoryRow, database: Db = db): Promise<void> {
  const { tdId, ...values } = row;
  await database
    .insert(tdHistoricalBaselines)
    .values(row)
    .onConflictDoUpdate({ target: tdHistoricalBaselines.tdId, set: { ...values, updatedAt: sql`now()` } });
}

/** Take one TD's background down at once (a complaint, a correction). True when a row went. */
export async function deleteHistory(tdId: number, database: Db = db): Promise<boolean> {
  const rows = await database.delete(tdHistoricalBaselines).where(eq(tdHistoricalBaselines.tdId, tdId)).returning({ id: tdHistoricalBaselines.id });
  return rows.length > 0;
}

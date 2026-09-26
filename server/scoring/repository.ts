/**
 * Every read and write of the scoring tables. Nothing else touches them.
 */
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import {
  tdHistoricalBaselines,
  tdScores,
  tds,
  type Td,
  type TdHistoricalBaselineRow,
  type TdScoreRow,
} from '@shared/schema/politics';
import type { TdParliamentStatsRow } from '@shared/schema/parliament';
import { allStats } from '../parliament/repository';
import { questionsAsked, type RollupInput, type RollupResult } from './rollup';
import { planTdSync, type ExistingTd, type TdSeed, type TdSyncPlan } from './tdSync';

export interface TdWithScore {
  td: Td;
  score: TdScoreRow | null;
  /** The TD's Oireachtas record from server/parliament: raw counts and whether they hold the chair. */
  stats: TdParliamentStatsRow | null;
}

const withScore = (database: Db) =>
  database
    .select({ td: tds, score: tdScores })
    .from(tds)
    .leftJoin(tdScores, eq(tdScores.tdId, tds.id));

/** Attach each TD's parliament record, read through server/parliament, which owns the table. */
async function withStats(rows: Array<Omit<TdWithScore, 'stats'>>, database: Db): Promise<TdWithScore[]> {
  if (rows.length === 0) return [];
  const stats = new Map((await allStats(database)).map((s) => [s.tdId, s]));
  return rows.map((r) => ({ ...r, stats: stats.get(r.td.id) ?? null }));
}

/** Active TDs with their score row, best first, ties by name. TDs with no score sort last. */
export async function listActive(database: Db = db): Promise<TdWithScore[]> {
  const rows = await withScore(database)
    .where(eq(tds.isActive, true))
    .orderBy(sql`${tdScores.overallScore} desc nulls last`, asc(tds.name));
  return withStats(rows, database);
}

/** Case-insensitive exact name match. */
export async function findByName(name: string, database: Db = db): Promise<TdWithScore | null> {
  const rows = await withScore(database)
    .where(sql`lower(${tds.name}) = lower(${name.trim()})`)
    .limit(1);
  return (await withStats(rows, database))[0] ?? null;
}

export async function findById(id: number, database: Db = db): Promise<TdWithScore | null> {
  const rows = await withScore(database).where(eq(tds.id, id)).limit(1);
  return (await withStats(rows, database))[0] ?? null;
}

export async function listByParty(party: string, database: Db = db): Promise<TdWithScore[]> {
  const rows = await withScore(database)
    .where(and(eq(tds.isActive, true), sql`lower(${tds.party}) = lower(${party})`))
    .orderBy(sql`${tdScores.overallScore} desc nulls last`, asc(tds.name));
  return withStats(rows, database);
}

export async function listByConstituency(constituency: string, database: Db = db): Promise<TdWithScore[]> {
  const rows = await withScore(database)
    .where(and(eq(tds.isActive, true), sql`lower(${tds.constituency}) = lower(${constituency})`))
    .orderBy(sql`${tdScores.overallScore} desc nulls last`, asc(tds.name));
  return withStats(rows, database);
}

/** Substring search over name, party and constituency, best-scored first. */
export async function search(query: string, limit: number, database: Db = db): Promise<TdWithScore[]> {
  const pattern = `%${query.trim()}%`;
  const rows = await withScore(database)
    .where(
      and(
        eq(tds.isActive, true),
        sql`(${tds.name} ilike ${pattern} or ${tds.party} ilike ${pattern} or ${tds.constituency} ilike ${pattern})`,
      ),
    )
    .orderBy(sql`${tdScores.overallScore} desc nulls last`, asc(tds.name))
    .limit(limit);
  return withStats(rows, database);
}

/** Distinct constituency names of active TDs. Importers write NULL for senators. */
export async function listConstituencies(database: Db = db): Promise<string[]> {
  const rows = await database
    .selectDistinct({ constituency: tds.constituency })
    .from(tds)
    .where(and(eq(tds.isActive, true), isNotNull(tds.constituency)))
    .orderBy(asc(tds.constituency));
  return rows.map((r) => r.constituency as string);
}

export interface SyncTdsResult {
  inserted: number;
  updated: number;
  deactivated: number;
}

/**
 * Bring `tds` in line with a roster of current Dáil members. One transaction, so a
 * half-applied roster is never visible. Nothing is deleted: see tdSync.ts.
 */
export async function syncTds(seeds: TdSeed[], database: Db = db): Promise<SyncTdsResult> {
  const current = await database
    .select({
      id: tds.id,
      name: tds.name,
      party: tds.party,
      constituency: tds.constituency,
      memberCode: tds.memberCode,
      imageUrl: tds.imageUrl,
      isActive: tds.isActive,
    })
    .from(tds);

  const plan: TdSyncPlan = planTdSync(current as ExistingTd[], seeds);
  const now = new Date();

  await database.transaction(async (tx) => {
    if (plan.insert.length > 0) {
      await tx.insert(tds).values(plan.insert.map((s) => ({ ...s, isActive: true, updatedAt: now })));
    }
    for (const { id, seed } of plan.update) {
      await tx.update(tds).set({ ...seed, isActive: true, updatedAt: now }).where(eq(tds.id, id));
    }
    if (plan.deactivate.length > 0) {
      await tx.update(tds).set({ isActive: false, updatedAt: now }).where(inArray(tds.id, plan.deactivate));
    }
  });

  return { inserted: plan.insert.length, updated: plan.update.length, deactivated: plan.deactivate.length };
}

/** Update the parliamentary inputs the rollup reads. Identified by member code. */
export async function updateParliamentaryActivity(
  rows: Array<{
    memberCode: string;
    questionsOral: number | null;
    questionsWritten: number | null;
    attendancePct: number | null;
    committeeAttendancePct: number | null;
  }>,
  database: Db = db,
): Promise<number> {
  if (rows.length === 0) return 0;
  let updated = 0;
  await database.transaction(async (tx) => {
    for (const r of rows) {
      const res = await tx
        .update(tds)
        .set({
          questionCountOral: r.questionsOral,
          questionCountWritten: r.questionsWritten,
          attendancePct: r.attendancePct,
          committeeAttendancePct: r.committeeAttendancePct,
          updatedAt: new Date(),
        })
        .where(eq(tds.memberCode, r.memberCode));
      updated += (res as { rowCount?: number }).rowCount ?? 0;
    }
  });
  return updated;
}

/** Everything the rollup needs, for active TDs. Debate scores are supplied by the caller. */
export async function rollupInputs(
  debateScores: Map<number, number>,
  database: Db = db,
): Promise<RollupInput[]> {
  const rows = await listActive(database);
  return rows.map(({ td, stats }) => ({
    tdId: td.id,
    party: td.party,
    constituency: td.constituency,
    questions: questionsAsked(td.questionCountOral, td.questionCountWritten),
    attendancePct: td.attendancePct,
    committeeAttendancePct: td.committeeAttendancePct,
    debateScore: debateScores.get(td.id) ?? null,
    isPresiding: stats?.isPresiding ?? false,
    // No expectation computed yet (no stats row, or a row from before the fairness columns:
    // recomputeStats always sets divisions_chaired) is undefined, not "not expected" (NULL).
    questionsExpected: stats && stats.divisionsChaired !== null ? stats.questionsExpected : undefined,
    attendanceBenchmark: stats && stats.divisionsChaired !== null ? stats.attendanceBenchmark : undefined,
  }));
}

export async function writeRollup(results: RollupResult[], database: Db = db): Promise<void> {
  const now = new Date();
  await database.transaction(async (tx) => {
    for (const r of results) {
      const set = {
        parliamentaryScore: r.parliamentaryScore,
        debateScore: r.debateScore,
        overallScore: r.overallScore,
        nationalRank: r.nationalRank,
        partyRank: r.partyRank,
        constituencyRank: r.constituencyRank,
        computedAt: now,
        updatedAt: now,
      };
      await tx
        .insert(tdScores)
        .values({ tdId: r.tdId, ...set })
        .onConflictDoUpdate({ target: tdScores.tdId, set });
    }
  });
}

export async function listBaselines(database: Db = db): Promise<TdHistoricalBaselineRow[]> {
  return database.select().from(tdHistoricalBaselines);
}

export async function baselineFor(tdId: number, database: Db = db): Promise<TdHistoricalBaselineRow | null> {
  const rows = await database.select().from(tdHistoricalBaselines).where(eq(tdHistoricalBaselines.tdId, tdId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Every read and write of the scoring tables. Nothing else touches them.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import {
  articleTdScores,
  partyScores,
  tdHistoricalBaselines,
  tdPolicyStances,
  tdScoreHistory,
  tdScores,
  tds,
  type Td,
  type TdHistoricalBaselineRow,
  type TdScoreRow,
} from '@shared/schema/politics';
import { type EloChange, type EloRatings, baselineRatings } from './elo';
import type { RollupInput, RollupResult } from './rollup';
import type { PartyScore } from './party';
import { planTdSync, type ExistingTd, type TdSeed, type TdSyncPlan } from './tdSync';

export interface TdWithScore {
  td: Td;
  score: TdScoreRow | null;
}

const withScore = (database: Db) =>
  database
    .select({ td: tds, score: tdScores })
    .from(tds)
    .leftJoin(tdScores, eq(tdScores.tdId, tds.id));

/** Active TDs with their score row, best first. TDs never scored sort last. */
export async function listActive(database: Db = db): Promise<TdWithScore[]> {
  return withScore(database)
    .where(eq(tds.isActive, true))
    .orderBy(
      sql`${tdScores.overallScore} desc nulls last`,
      sql`${tdScores.overallElo} desc nulls last`,
      asc(tds.name),
    );
}

/** Case-insensitive exact name match. */
export async function findByName(name: string, database: Db = db): Promise<TdWithScore | null> {
  const rows = await withScore(database)
    .where(sql`lower(${tds.name}) = lower(${name.trim()})`)
    .limit(1);
  return rows[0] ?? null;
}

export async function findById(id: number, database: Db = db): Promise<TdWithScore | null> {
  const rows = await withScore(database).where(eq(tds.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findByIds(ids: number[], database: Db = db): Promise<TdWithScore[]> {
  if (ids.length === 0) return [];
  return withScore(database).where(inArray(tds.id, ids));
}

export async function listByParty(party: string, database: Db = db): Promise<TdWithScore[]> {
  return withScore(database)
    .where(and(eq(tds.isActive, true), sql`lower(${tds.party}) = lower(${party})`))
    .orderBy(sql`${tdScores.overallScore} desc nulls last`, asc(tds.name));
}

export async function listByConstituency(constituency: string, database: Db = db): Promise<TdWithScore[]> {
  return withScore(database)
    .where(and(eq(tds.isActive, true), sql`lower(${tds.constituency}) = lower(${constituency})`))
    .orderBy(sql`${tdScores.overallScore} desc nulls last`, asc(tds.name));
}

/** Substring search over name, party and constituency, best-scored first. */
export async function search(query: string, limit: number, database: Db = db): Promise<TdWithScore[]> {
  const pattern = `%${query.trim()}%`;
  return withScore(database)
    .where(
      and(
        eq(tds.isActive, true),
        sql`(${tds.name} ilike ${pattern} or ${tds.party} ilike ${pattern} or ${tds.constituency} ilike ${pattern})`,
      ),
    )
    .orderBy(sql`${tdScores.overallScore} desc nulls last`, asc(tds.name))
    .limit(limit);
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
  rows: Array<{ memberCode: string; questionsOral: number | null; questionsWritten: number | null; attendancePct: number | null }>,
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
          updatedAt: new Date(),
        })
        .where(eq(tds.memberCode, r.memberCode));
      updated += (res as { rowCount?: number }).rowCount ?? 0;
    }
  });
  return updated;
}

export function ratingsOf(score: TdScoreRow | null): EloRatings {
  if (!score) return baselineRatings();
  return {
    overall: score.overallElo,
    transparency: score.transparencyElo,
    effectiveness: score.effectivenessElo,
    integrity: score.integrityElo,
    consistency: score.consistencyElo,
  };
}

export interface ArticleMeta {
  articleId: number;
  credibility: number;
  confidence: number;
}

/**
 * Persist one article's effect on one TD: new ratings, story count, and one history
 * row per rating that moved. Atomic.
 */
export async function applyElo(
  tdId: number,
  updated: EloRatings,
  changes: EloChange[],
  meta: ArticleMeta,
  database: Db = db,
): Promise<void> {
  if (changes.length === 0) return;
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx
      .insert(tdScores)
      .values({
        tdId,
        overallElo: updated.overall,
        transparencyElo: updated.transparency,
        effectivenessElo: updated.effectiveness,
        integrityElo: updated.integrity,
        consistencyElo: updated.consistency,
        totalStories: 1,
        lastScoredAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: tdScores.tdId,
        set: {
          overallElo: updated.overall,
          transparencyElo: updated.transparency,
          effectivenessElo: updated.effectiveness,
          integrityElo: updated.integrity,
          consistencyElo: updated.consistency,
          totalStories: sql`${tdScores.totalStories} + 1`,
          lastScoredAt: now,
          updatedAt: now,
        },
      });
    await tx.insert(tdScoreHistory).values(
      changes.map((c) => ({
        tdId,
        articleId: meta.articleId,
        dimension: c.key,
        oldElo: c.oldElo,
        newElo: c.newElo,
        delta: c.delta,
        impact: c.impact,
        credibility: meta.credibility,
        confidence: meta.confidence,
      })),
    );
  });
}

export type ArticleScoreInput = typeof articleTdScores.$inferInsert;

export async function upsertArticleScore(row: ArticleScoreInput, database: Db = db): Promise<void> {
  const { id: _id, createdAt: _c, ...set } = row;
  await database
    .insert(articleTdScores)
    .values(row)
    .onConflictDoUpdate({ target: [articleTdScores.articleId, articleTdScores.tdId], set });
}

export type PolicyStanceInput = typeof tdPolicyStances.$inferInsert;

export async function upsertPolicyStance(row: PolicyStanceInput, database: Db = db): Promise<void> {
  const { id: _id, createdAt: _c, ...set } = row;
  await database
    .insert(tdPolicyStances)
    .values(row)
    .onConflictDoUpdate({ target: [tdPolicyStances.articleId, tdPolicyStances.tdId], set });
}

/** Everything the rollup needs, for active TDs. Debate scores are supplied by the caller. */
export async function rollupInputs(
  debateScores: Map<number, number>,
  database: Db = db,
): Promise<RollupInput[]> {
  const rows = await listActive(database);
  return rows.map(({ td, score }) => ({
    tdId: td.id,
    party: td.party,
    constituency: td.constituency,
    overallElo: score?.overallElo ?? baselineRatings().overall,
    questions:
      td.questionCountOral === null && td.questionCountWritten === null
        ? null
        : (td.questionCountOral ?? 0) + (td.questionCountWritten ?? 0),
    attendancePct: td.attendancePct,
    debateScore: debateScores.get(td.id) ?? null,
  }));
}

export async function writeRollup(results: RollupResult[], database: Db = db): Promise<void> {
  const now = new Date();
  await database.transaction(async (tx) => {
    for (const r of results) {
      const set = {
        newsScore: r.newsScore,
        parliamentaryScore: r.parliamentaryScore,
        debateScore: r.debateScore,
        overallScore: r.overallScore,
        nationalRank: r.nationalRank,
        partyRank: r.partyRank,
        constituencyRank: r.constituencyRank,
        updatedAt: now,
      };
      await tx
        .insert(tdScores)
        .values({ tdId: r.tdId, ...set })
        .onConflictDoUpdate({ target: tdScores.tdId, set });
    }
  });
}

/** 7- and 30-day overall ELO movement per TD, from the history table. */
export async function writeTrends(database: Db = db): Promise<void> {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const sums = await database
    .select({
      tdId: tdScoreHistory.tdId,
      d7: sql<number>`coalesce(sum(case when ${tdScoreHistory.createdAt} >= ${since7} then ${tdScoreHistory.delta} else 0 end), 0)::int`,
      d30: sql<number>`coalesce(sum(${tdScoreHistory.delta}), 0)::int`,
    })
    .from(tdScoreHistory)
    .where(and(eq(tdScoreHistory.dimension, 'overall'), gte(tdScoreHistory.createdAt, since30)))
    .groupBy(tdScoreHistory.tdId);

  await database.transaction(async (tx) => {
    await tx.update(tdScores).set({ eloChange7d: 0, eloChange30d: 0 });
    for (const s of sums) {
      await tx.update(tdScores).set({ eloChange7d: s.d7, eloChange30d: s.d30 }).where(eq(tdScores.tdId, s.tdId));
    }
  });
}

export interface Mover {
  td: Td;
  score: TdScoreRow | null;
  delta: number;
  articles: number;
}

/** TDs whose overall ELO moved most in the window, with how many articles did it. */
export async function movers(days: number, limit: number, database: Db = db): Promise<Mover[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const agg = await database
    .select({
      tdId: tdScoreHistory.tdId,
      delta: sql<number>`sum(${tdScoreHistory.delta})::int`,
      articles: sql<number>`count(distinct ${tdScoreHistory.articleId})::int`,
    })
    .from(tdScoreHistory)
    .where(and(eq(tdScoreHistory.dimension, 'overall'), gte(tdScoreHistory.createdAt, since)))
    .groupBy(tdScoreHistory.tdId)
    .orderBy(sql`abs(sum(${tdScoreHistory.delta})) desc`)
    .limit(limit);
  if (agg.length === 0) return [];
  const rows = await findByIds(
    agg.map((a) => a.tdId),
    database,
  );
  const byId = new Map(rows.map((r) => [r.td.id, r]));
  return agg
    .map((a) => {
      const row = byId.get(a.tdId);
      return row ? { ...row, delta: a.delta, articles: a.articles } : null;
    })
    .filter((m): m is Mover => m !== null);
}

export async function replacePartyScores(scores: PartyScore[], database: Db = db): Promise<void> {
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx.delete(partyScores);
    if (scores.length > 0) {
      await tx.insert(partyScores).values(scores.map((s) => ({ ...s, computedAt: now })));
    }
  });
}

export async function listPartyScores(database: Db = db) {
  return database.select().from(partyScores).orderBy(desc(partyScores.avgElo), asc(partyScores.party));
}

export async function listBaselines(database: Db = db): Promise<TdHistoricalBaselineRow[]> {
  return database.select().from(tdHistoricalBaselines);
}

export async function baselineFor(tdId: number, database: Db = db): Promise<TdHistoricalBaselineRow | null> {
  const rows = await database.select().from(tdHistoricalBaselines).where(eq(tdHistoricalBaselines.tdId, tdId)).limit(1);
  return rows[0] ?? null;
}

export async function recentArticleScores(tdId: number, limit: number, database: Db = db) {
  return database
    .select()
    .from(articleTdScores)
    .where(eq(articleTdScores.tdId, tdId))
    .orderBy(desc(articleTdScores.createdAt))
    .limit(limit);
}

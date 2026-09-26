/**
 * Every read and write of the pledge tables. Nothing else touches them.
 */
import { asc, count, desc, eq, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import {
  pledgeCategoryPriorities,
  pledgeEvidence,
  pledges,
  type NewPledge,
  type NewPledgeEvidence,
  type PledgeEvidenceRow,
  type PledgeRow,
} from '@shared/schema/pledges';
import { divisions } from '@shared/schema/parliament';
import type { Pledge, PledgeCategory, PledgeEvidence, PledgeStatus, EvidenceKind } from '@shared/pledges';

const toPledge = (row: PledgeRow, evidenceCount: number): Pledge => ({
  id: row.id,
  party: row.party,
  title: row.title,
  description: row.description,
  category: row.category as PledgeCategory,
  electionYear: row.electionYear,
  targetDate: row.targetDate,
  status: row.status as PledgeStatus,
  statusNote: row.statusNote,
  sourceUrl: row.sourceUrl,
  reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  evidenceCount,
});

const toEvidence = (row: PledgeEvidenceRow): PledgeEvidence => ({
  id: row.id,
  kind: row.kind as EvidenceKind,
  summary: row.summary,
  occurredOn: row.occurredOn,
  sourceUrl: row.sourceUrl,
  divisionId: row.divisionId,
});

/**
 * Pledges with their evidence count, by join + group rather than a correlated subquery.
 * Drizzle drops table names from expressions in a single-table SELECT list, so a
 * subquery written there compared evidence.pledge_id with the EVIDENCE row's own id and
 * returned a wrong count without any error. A join makes it qualify every column.
 */
const withEvidenceCount = (database: Db) =>
  database
    .select({ pledge: pledges, evidenceCount: sql<number>`count(${pledgeEvidence.id})`.mapWith(Number) })
    .from(pledges)
    .leftJoin(pledgeEvidence, eq(pledgeEvidence.pledgeId, pledges.id))
    .groupBy(pledges.id);

/** Every pledge, or one party's (case-insensitive), newest election first. */
export async function listPledges(party?: string, database: Db = db): Promise<Pledge[]> {
  const rows = await withEvidenceCount(database)
    .where(party ? sql`lower(${pledges.party}) = lower(${party})` : undefined)
    .orderBy(desc(pledges.electionYear), asc(pledges.category), asc(pledges.title));
  return rows.map((r) => toPledge(r.pledge, r.evidenceCount));
}

export async function pledgeWithEvidence(id: number, database: Db = db) {
  const [row] = await withEvidenceCount(database).where(eq(pledges.id, id));
  if (!row) return null;
  const evidence = await database
    .select()
    .from(pledgeEvidence)
    .where(eq(pledgeEvidence.pledgeId, id))
    .orderBy(desc(pledgeEvidence.occurredOn), desc(pledgeEvidence.id));
  return { ...toPledge(row.pledge, row.evidenceCount), evidence: evidence.map(toEvidence) };
}

/** Null when the same party already has a pledge with that title for that election. */
export async function createPledge(input: NewPledge, database: Db = db): Promise<Pledge | null> {
  const [row] = await database.insert(pledges).values(input).onConflictDoNothing().returning();
  return row ? toPledge(row, 0) : null;
}

/** A status change stamps reviewedAt, because only a person reviewing sets it. */
export async function updatePledge(
  id: number,
  changes: Partial<Omit<NewPledge, 'id' | 'createdAt' | 'updatedAt' | 'reviewedAt'>>,
  database: Db = db,
): Promise<Pledge | null> {
  const [row] = await database
    .update(pledges)
    .set({ ...changes, updatedAt: new Date(), ...(changes.status ? { reviewedAt: new Date() } : {}) })
    .where(eq(pledges.id, id))
    .returning();
  if (!row) return null;
  const [{ n }] = await database.select({ n: count() }).from(pledgeEvidence).where(eq(pledgeEvidence.pledgeId, id));
  return toPledge(row, Number(n));
}

export async function deletePledge(id: number, database: Db = db): Promise<boolean> {
  const deleted = await database.delete(pledges).where(eq(pledges.id, id)).returning({ id: pledges.id });
  return deleted.length > 0;
}

/** The evidence names a division that politics.divisions does not hold. */
export class UnknownDivisionError extends Error {
  constructor(readonly divisionId: string) {
    super(`No recorded Dáil vote has id ${divisionId}`);
  }
}

/** Null when the pledge does not exist. */
export async function addEvidence(input: NewPledgeEvidence, database: Db = db): Promise<PledgeEvidence | null> {
  const [exists] = await database.select({ id: pledges.id }).from(pledges).where(eq(pledges.id, input.pledgeId));
  if (!exists) return null;
  if (input.divisionId) {
    const [division] = await database.select({ id: divisions.id }).from(divisions).where(eq(divisions.id, input.divisionId));
    if (!division) throw new UnknownDivisionError(input.divisionId);
  }
  const [row] = await database.insert(pledgeEvidence).values(input).returning();
  await database.update(pledges).set({ updatedAt: new Date() }).where(eq(pledges.id, input.pledgeId));
  return toEvidence(row!);
}

export async function deleteEvidence(id: number, database: Db = db): Promise<boolean> {
  const deleted = await database.delete(pledgeEvidence).where(eq(pledgeEvidence.id, id)).returning({ id: pledgeEvidence.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------------------
// Priorities
// ---------------------------------------------------------------------------

export async function allPriorityRows(database: Db = db) {
  const rows = await database
    .select({
      userId: pledgeCategoryPriorities.userId,
      category: pledgeCategoryPriorities.category,
      rank: pledgeCategoryPriorities.rank,
    })
    .from(pledgeCategoryPriorities);
  return rows.map((r) => ({ ...r, category: r.category as PledgeCategory }));
}

export async function userRanking(userId: string, database: Db = db): Promise<PledgeCategory[] | null> {
  const rows = await database
    .select({ category: pledgeCategoryPriorities.category })
    .from(pledgeCategoryPriorities)
    .where(eq(pledgeCategoryPriorities.userId, userId))
    .orderBy(asc(pledgeCategoryPriorities.rank));
  return rows.length ? rows.map((r) => r.category as PledgeCategory) : null;
}

/** Replace a user's whole ranking atomically; an empty ranking clears it. */
export async function saveRanking(userId: string, ranking: readonly PledgeCategory[], database: Db = db): Promise<void> {
  await database.transaction(async (tx) => {
    // Serialise one user's saves: two at once would both delete, then both insert and collide.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    await tx.delete(pledgeCategoryPriorities).where(eq(pledgeCategoryPriorities.userId, userId));
    if (ranking.length === 0) return;
    await tx
      .insert(pledgeCategoryPriorities)
      .values(ranking.map((category, index) => ({ userId, category, rank: index + 1 })));
  });
}

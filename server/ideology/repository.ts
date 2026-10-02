/**
 * Every read and write of the quiz and ideology tables. Nothing else touches them.
 */
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db, type Db } from '../db';
import { tds } from '@shared/schema/politics';
import {
  ideologyProfiles,
  quizResults,
  tdIdeologyEvidence,
  type EvidenceSource,
  type IdeologyProfileRow,
  type NewTdIdeologyEvidence,
  type ProfileSubject,
  type QuizResultRow,
  type TdIdeologyEvidenceRow,
} from '@shared/schema/quiz';
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension, type IdeologyVector } from '@shared/ideology';
import type { EvidenceCounts } from '@shared/ideologyMatch';
import type { QuizResponse } from '@shared/quiz';
import type { Profile } from './model';

export function vectorOf(row: IdeologyVector): IdeologyVector {
  return Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, row[d]])) as IdeologyVector;
}

// --- quiz ------------------------------------------------------------------

export async function insertQuizResult(
  input: { userId: string; answers: QuizResponse[]; vector: IdeologyVector; ideology: string; description: string },
  database: Db = db,
): Promise<QuizResultRow> {
  const [row] = await database
    .insert(quizResults)
    .values({ userId: input.userId, answers: input.answers, ...input.vector, ideology: input.ideology, description: input.description })
    .returning();
  return row!;
}

/** Newest first. */
export async function listQuizResults(userId: string, database: Db = db): Promise<QuizResultRow[]> {
  return database.select().from(quizResults).where(eq(quizResults.userId, userId)).orderBy(desc(quizResults.createdAt), desc(quizResults.id));
}

export async function latestQuizResult(userId: string, database: Db = db): Promise<QuizResultRow | null> {
  const rows = await database
    .select()
    .from(quizResults)
    .where(eq(quizResults.userId, userId))
    .orderBy(desc(quizResults.createdAt), desc(quizResults.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAllQuizResults(database: Db = db): Promise<QuizResultRow[]> {
  return database.select().from(quizResults);
}

/** Overwrite a stored result's score, e.g. after the scoring formula or the bank changes. */
export async function updateQuizScore(
  id: number,
  score: { vector: IdeologyVector; ideology: string; description: string },
  database: Db = db,
): Promise<void> {
  await database
    .update(quizResults)
    .set({ ...score.vector, ideology: score.ideology, description: score.description })
    .where(eq(quizResults.id, id));
}

export async function listQuizUserIds(database: Db = db): Promise<string[]> {
  const rows = await database.selectDistinct({ userId: quizResults.userId }).from(quizResults);
  return rows.map((r) => r.userId);
}

// --- TDs -------------------------------------------------------------------

export interface TdRef {
  id: number;
  name: string;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
}

const tdRefColumns = { id: tds.id, name: tds.name, party: tds.party, constituency: tds.constituency, imageUrl: tds.imageUrl };

export async function findTdIdByName(name: string, database: Db = db): Promise<number | null> {
  const rows = await database.select({ id: tds.id }).from(tds).where(sql`lower(${tds.name}) = lower(${name.trim()})`).limit(1);
  return rows[0]?.id ?? null;
}

export async function findTd(id: number, database: Db = db): Promise<TdRef | null> {
  const rows = await database.select(tdRefColumns).from(tds).where(eq(tds.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listActiveTds(database: Db = db): Promise<TdRef[]> {
  return database.select(tdRefColumns).from(tds).where(eq(tds.isActive, true)).orderBy(asc(tds.name));
}

// --- TD evidence -----------------------------------------------------------

/**
 * Idempotent on (TD, source, sourceRef). Returns false when nothing was written.
 *
 * A `stance` is the TD's CURRENT answer to one question, so a later statement replaces it: every
 * value column is overwritten (a dimension the new answer is silent on becomes NULL), but only
 * when the new row is not older, so an older article never overwrites a newer position.
 * Every other source keeps the first row.
 */
export async function insertTdEvidence(row: NewTdIdeologyEvidence, database: Db = db): Promise<boolean> {
  const insert = database.insert(tdIdeologyEvidence).values(row);
  const written =
    row.source === 'stance'
      ? await insert
          .onConflictDoUpdate({
            target: [tdIdeologyEvidence.tdId, tdIdeologyEvidence.source, tdIdeologyEvidence.sourceRef],
            set: {
              ...Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, row[d] ?? null])),
              policyTopic: row.policyTopic ?? null,
              weight: row.weight,
              observedAt: row.observedAt,
            },
            setWhere: sql`excluded.observed_at >= ${tdIdeologyEvidence.observedAt}`,
          })
          .returning({ id: tdIdeologyEvidence.id })
      : await insert.onConflictDoNothing().returning({ id: tdIdeologyEvidence.id });
  return written.length > 0;
}

/** Delete every evidence row of one source; with `dryRun`, only count them. */
export async function deleteTdEvidenceBySource(source: EvidenceSource, dryRun: boolean, database: Db = db): Promise<number> {
  const where = eq(tdIdeologyEvidence.source, source);
  if (dryRun) {
    const [row] = await database.select({ n: sql<number>`count(*)::int` }).from(tdIdeologyEvidence).where(where);
    return Number(row?.n ?? 0);
  }
  const deleted = await database.delete(tdIdeologyEvidence).where(where).returning({ id: tdIdeologyEvidence.id });
  return deleted.length;
}

export async function listTdEvidence(tdId: number, database: Db = db): Promise<TdIdeologyEvidenceRow[]> {
  return database.select().from(tdIdeologyEvidence).where(eq(tdIdeologyEvidence.tdId, tdId));
}

export interface EvidenceSummary {
  bySource: EvidenceCounts;
  /** Dimensions at least one row speaks to. Same as support > 0: weight > 0 by CHECK, decay > 0. */
  measured: IdeologyDimension[];
}

/** Per TD (one TD with `tdId`): evidence rows per source and the dimensions they measure. One grouped query. */
export async function evidenceSummary(tdId?: number, database: Db = db): Promise<Map<number, EvidenceSummary>> {
  const perDimension = Object.fromEntries(
    IDEOLOGY_DIMENSIONS.map((d) => [d, sql<number>`count(${tdIdeologyEvidence[d]})::int`]),
  ) as Record<IdeologyDimension, SQL<number>>;
  const rows = await database
    .select({ tdId: tdIdeologyEvidence.tdId, source: tdIdeologyEvidence.source, n: sql<number>`count(*)::int`, ...perDimension })
    .from(tdIdeologyEvidence)
    .where(tdId === undefined ? undefined : eq(tdIdeologyEvidence.tdId, tdId))
    .groupBy(tdIdeologyEvidence.tdId, tdIdeologyEvidence.source);
  const byTd = new Map<number, { bySource: EvidenceCounts; dims: Set<IdeologyDimension> }>();
  for (const row of rows) {
    const entry = byTd.get(row.tdId) ?? { bySource: {}, dims: new Set<IdeologyDimension>() };
    entry.bySource[row.source as EvidenceSource] = row.n;
    for (const d of IDEOLOGY_DIMENSIONS) if (row[d] > 0) entry.dims.add(d);
    byTd.set(row.tdId, entry);
  }
  return new Map(
    Array.from(byTd, ([id, { bySource, dims }]) => [id, { bySource, measured: IDEOLOGY_DIMENSIONS.filter((d) => dims.has(d)) }]),
  );
}

// --- profiles --------------------------------------------------------------

export async function upsertProfile(
  kind: ProfileSubject,
  subjectId: string,
  profile: Omit<Profile, 'support'>,
  database: Db = db,
): Promise<void> {
  const values = {
    subjectKind: kind,
    subjectId,
    ...profile.vector,
    totalWeight: profile.totalWeight,
    evidenceCount: profile.evidenceCount,
    computedAt: new Date(),
  };
  await database
    .insert(ideologyProfiles)
    .values(values)
    .onConflictDoUpdate({ target: [ideologyProfiles.subjectKind, ideologyProfiles.subjectId], set: values });
}

export async function deleteProfile(kind: ProfileSubject, subjectId: string, database: Db = db): Promise<void> {
  await database.delete(ideologyProfiles).where(and(eq(ideologyProfiles.subjectKind, kind), eq(ideologyProfiles.subjectId, subjectId)));
}

export async function getProfile(kind: ProfileSubject, subjectId: string, database: Db = db): Promise<IdeologyProfileRow | null> {
  const rows = await database
    .select()
    .from(ideologyProfiles)
    .where(and(eq(ideologyProfiles.subjectKind, kind), eq(ideologyProfiles.subjectId, subjectId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listProfiles(kind: ProfileSubject, database: Db = db): Promise<IdeologyProfileRow[]> {
  return database.select().from(ideologyProfiles).where(eq(ideologyProfiles.subjectKind, kind));
}

export async function listUserProfileIds(database: Db = db): Promise<string[]> {
  const rows = await database.select({ id: ideologyProfiles.subjectId }).from(ideologyProfiles).where(eq(ideologyProfiles.subjectKind, 'user'));
  return rows.map((r) => r.id);
}

/**
 * Parliamentary question counts per TD, month, department and type. One source for both
 * the totals the scoring pillar reads and the "question focus" a profile shows.
 */
import { eq, inArray, sql } from 'drizzle-orm';
import { questionCounts } from '@shared/schema/parliament';
import type { TdQuestionTopic } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import type { QuestionCountRow } from '../parse';
import { chunks } from './util';

/** Replace the counts for these months (first-of-month dates) with `rows`. */
export async function replaceQuestionMonths(months: string[], rows: QuestionCountRow[], tdIds: Map<string, number>, database: Db = db): Promise<void> {
  if (months.length === 0) return;
  await database.transaction(async (tx) => {
    await tx.delete(questionCounts).where(inArray(questionCounts.month, months));
    const values = rows.map((r) => ({ ...r, tdId: tdIds.get(r.memberCode) ?? null }));
    for (const batch of chunks(values)) await tx.insert(questionCounts).values(batch);
  });
}

/**
 * member code → oral and written totals from `since` (YYYY-MM-DD) on, by month. A member
 * with no row asked none in the ingested months, which is a real 0 once any month exists.
 */
export async function questionTotals(since: string, database: Db = db): Promise<Map<string, { oral: number; written: number }>> {
  const rows = await database
    .select({
      memberCode: questionCounts.memberCode,
      oral: sql<number>`coalesce(sum(${questionCounts.n}) filter (where ${questionCounts.questionType} = 'oral'), 0)::int`,
      written: sql<number>`coalesce(sum(${questionCounts.n}) filter (where ${questionCounts.questionType} = 'written'), 0)::int`,
    })
    .from(questionCounts)
    .where(sql`${questionCounts.month} >= date_trunc('month', ${since}::date)`)
    .groupBy(questionCounts.memberCode);
  return new Map(rows.map((r) => [r.memberCode, { oral: Number(r.oral), written: Number(r.written) }]));
}

/** Whether any question month has been ingested at all (so a missing member means 0, not unknown). */
export async function hasQuestionCounts(database: Db = db): Promise<boolean> {
  const [row] = await database.select({ n: sql<number>`count(*)::int` }).from(questionCounts).limit(1);
  return Number(row?.n ?? 0) > 0;
}

/**
 * The questions one TD asked, from the monthly counts. NULL before any month is ingested,
 * so "not loaded yet" never reads as "asked none".
 */
export async function questionsAskedBy(tdId: number, database: Db = db): Promise<{ oral: number; written: number } | null> {
  if (!(await hasQuestionCounts(database))) return null;
  const [row] = await database
    .select({
      oral: sql<number>`coalesce(sum(${questionCounts.n}) filter (where ${questionCounts.questionType} = 'oral'), 0)::int`,
      written: sql<number>`coalesce(sum(${questionCounts.n}) filter (where ${questionCounts.questionType} = 'written'), 0)::int`,
    })
    .from(questionCounts)
    .where(eq(questionCounts.tdId, tdId));
  return { oral: Number(row?.oral ?? 0), written: Number(row?.written ?? 0) };
}

export async function tdQuestionTopics(tdId: number, database: Db = db): Promise<TdQuestionTopic[]> {
  const rows = await database
    .select({
      department: questionCounts.department,
      oral: sql<number>`coalesce(sum(${questionCounts.n}) filter (where ${questionCounts.questionType} = 'oral'), 0)::int`,
      written: sql<number>`coalesce(sum(${questionCounts.n}) filter (where ${questionCounts.questionType} = 'written'), 0)::int`,
    })
    .from(questionCounts)
    .where(eq(questionCounts.tdId, tdId))
    .groupBy(questionCounts.department)
    .orderBy(sql`sum(${questionCounts.n}) desc`, questionCounts.department);
  return rows.map((r) => ({ department: r.department, oral: Number(r.oral), written: Number(r.written) }));
}

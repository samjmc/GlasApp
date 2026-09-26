/**
 * Every read and write of the voting tables. Nothing else touches them: other domains
 * go through the functions exported from ./index.ts.
 */
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import {
  dailySessionItems,
  dailySessions,
  policyQuestionOptions,
  policyQuestions,
  policyVotes,
  type DailySessionRow,
  type NewPolicyQuestion,
  type NewPolicyQuestionOption,
  type PolicyQuestionOptionRow,
  type PolicyQuestionRow,
} from '@shared/schema/voting';
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '../constants/ideology';
import type { DailySessionCompletion, QuestionTally, VoteSource } from '@shared/voting';
import type { OptionVector } from './questions';
import type { QuestionCandidate } from './selection';

const asDimension = (value: string | null): IdeologyDimension | null =>
  value !== null && (IDEOLOGY_DIMENSIONS as readonly string[]).includes(value) ? (value as IdeologyDimension) : null;

export const vectorOf = (option: PolicyQuestionOptionRow): OptionVector => ({
  economic: option.economic,
  social: option.social,
  cultural: option.cultural,
  authority: option.authority,
  environmental: option.environmental,
  welfare: option.welfare,
  globalism: option.globalism,
  technocratic: option.technocratic,
});

export interface QuestionWithOptions {
  question: PolicyQuestionRow;
  options: PolicyQuestionOptionRow[];
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function hasQuestionForArticle(articleId: number, database: Db = db): Promise<boolean> {
  const rows = await database
    .select({ id: policyQuestions.id })
    .from(policyQuestions)
    .where(eq(policyQuestions.articleId, articleId))
    .limit(1);
  return rows.length > 0;
}

/** How often each axis was the target of questions made since `since`. */
export async function primaryDimensionCounts(
  since: Date,
  database: Db = db,
): Promise<Partial<Record<IdeologyDimension, number>>> {
  const rows = await database
    .select({ dimension: policyQuestions.primaryDimension, n: count() })
    .from(policyQuestions)
    .where(and(gte(policyQuestions.createdAt, since), isNotNull(policyQuestions.primaryDimension)))
    .groupBy(policyQuestions.primaryDimension);
  const counts: Partial<Record<IdeologyDimension, number>> = {};
  for (const row of rows) {
    const dimension = asDimension(row.dimension);
    if (dimension) counts[dimension] = Number(row.n);
  }
  return counts;
}

/**
 * Insert a question and its options atomically. One question per article: if another
 * process saved one first, nothing is written and the existing id is returned.
 */
export async function saveQuestion(
  input: { question: NewPolicyQuestion; options: Array<Omit<NewPolicyQuestionOption, 'questionId'>> },
  database: Db = db,
): Promise<{ id: number; created: boolean }> {
  return database.transaction(async (tx) => {
    const inserted = await tx
      .insert(policyQuestions)
      .values(input.question)
      .onConflictDoNothing({ target: policyQuestions.articleId })
      .returning({ id: policyQuestions.id });

    if (inserted.length === 0) {
      const [existing] = await tx
        .select({ id: policyQuestions.id })
        .from(policyQuestions)
        .where(eq(policyQuestions.articleId, input.question.articleId));
      return { id: existing!.id, created: false };
    }

    const id = inserted[0]!.id;
    await tx.insert(policyQuestionOptions).values(input.options.map((option) => ({ ...option, questionId: id })));
    return { id, created: true };
  });
}

async function withOptions(questions: PolicyQuestionRow[], database: Db): Promise<QuestionWithOptions[]> {
  if (questions.length === 0) return [];
  const options = await database
    .select()
    .from(policyQuestionOptions)
    .where(
      inArray(
        policyQuestionOptions.questionId,
        questions.map((q) => q.id),
      ),
    )
    .orderBy(asc(policyQuestionOptions.position));
  return questions.map((question) => ({
    question,
    options: options.filter((option) => option.questionId === question.id),
  }));
}

export async function questionsForArticles(articleIds: number[], database: Db = db): Promise<QuestionWithOptions[]> {
  if (articleIds.length === 0) return [];
  const questions = await database.select().from(policyQuestions).where(inArray(policyQuestions.articleId, articleIds));
  return withOptions(questions, database);
}

export async function questionsByIds(questionIds: number[], database: Db = db): Promise<QuestionWithOptions[]> {
  if (questionIds.length === 0) return [];
  const questions = await database.select().from(policyQuestions).where(inArray(policyQuestions.id, questionIds));
  return withOptions(questions, database);
}

export async function questionById(questionId: number, database: Db = db): Promise<QuestionWithOptions | null> {
  const questions = await database.select().from(policyQuestions).where(eq(policyQuestions.id, questionId));
  const [found] = await withOptions(questions, database);
  return found ?? null;
}

// ---------------------------------------------------------------------------
// Session building
// ---------------------------------------------------------------------------

/** Questions made since `since` that this user has not answered, newest first. */
export async function unansweredCandidates(
  userId: string,
  since: Date,
  limit: number,
  database: Db = db,
): Promise<QuestionCandidate[]> {
  const rows = await database
    .select({
      questionId: policyQuestions.id,
      primaryDimension: policyQuestions.primaryDimension,
      createdAt: policyQuestions.createdAt,
    })
    .from(policyQuestions)
    .where(
      and(
        gte(policyQuestions.createdAt, since),
        sql`not exists (select 1 from ${policyVotes} where ${policyVotes.questionId} = ${policyQuestions.id} and ${policyVotes.userId} = ${userId})`,
      ),
    )
    .orderBy(desc(policyQuestions.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, primaryDimension: asDimension(row.primaryDimension) }));
}

/** How many questions on each axis this user has answered since `since`. */
export async function answeredAxisCounts(
  userId: string,
  since: Date,
  database: Db = db,
): Promise<Partial<Record<IdeologyDimension, number>>> {
  const rows = await database
    .select({ dimension: policyQuestions.primaryDimension, n: count() })
    .from(policyVotes)
    .innerJoin(policyQuestions, eq(policyQuestions.id, policyVotes.questionId))
    .where(and(eq(policyVotes.userId, userId), gte(policyVotes.createdAt, since)))
    .groupBy(policyQuestions.primaryDimension);
  const counts: Partial<Record<IdeologyDimension, number>> = {};
  for (const row of rows) {
    const dimension = asDimension(row.dimension);
    if (dimension) counts[dimension] = Number(row.n);
  }
  return counts;
}

export async function findSession(userId: string, sessionDate: string, database: Db = db): Promise<DailySessionRow | null> {
  const [row] = await database
    .select()
    .from(dailySessions)
    .where(and(eq(dailySessions.userId, userId), eq(dailySessions.sessionDate, sessionDate)));
  return row ?? null;
}

/**
 * Create today's session with its items. Two tabs opening at once race on the unique
 * (user, date) index; the loser reads the winner's session instead of failing.
 */
export async function createSession(
  input: {
    userId: string;
    sessionDate: string;
    county: string | null;
    constituency: string | null;
    profileBefore: Record<string, number> | null;
    questionIds: number[];
  },
  database: Db = db,
): Promise<DailySessionRow> {
  return database.transaction(async (tx) => {
    const [created] = await tx
      .insert(dailySessions)
      .values({
        userId: input.userId,
        sessionDate: input.sessionDate,
        county: input.county,
        constituency: input.constituency,
        profileBefore: input.profileBefore,
      })
      .onConflictDoNothing({ target: [dailySessions.userId, dailySessions.sessionDate] })
      .returning();

    if (!created) {
      const [existing] = await tx
        .select()
        .from(dailySessions)
        .where(and(eq(dailySessions.userId, input.userId), eq(dailySessions.sessionDate, input.sessionDate)));
      return existing!;
    }

    if (input.questionIds.length > 0) {
      await tx
        .insert(dailySessionItems)
        .values(input.questionIds.map((questionId, position) => ({ sessionId: created.id, questionId, position })));
    }
    return created;
  });
}

export interface SessionItemView {
  itemId: number;
  position: number;
  question: PolicyQuestionRow;
  options: PolicyQuestionOptionRow[];
  selectedOption: string | null;
}

/** A session's items in order, each with its question, options and this user's answer. */
export async function sessionItems(sessionId: number, userId: string, database: Db = db): Promise<SessionItemView[]> {
  const rows = await database
    .select({ item: dailySessionItems, question: policyQuestions, vote: policyVotes.optionKey })
    .from(dailySessionItems)
    .innerJoin(policyQuestions, eq(policyQuestions.id, dailySessionItems.questionId))
    .leftJoin(
      policyVotes,
      and(eq(policyVotes.questionId, dailySessionItems.questionId), eq(policyVotes.userId, userId)),
    )
    .where(eq(dailySessionItems.sessionId, sessionId))
    .orderBy(asc(dailySessionItems.position));

  const withOpts = await withOptions(
    rows.map((row) => row.question),
    database,
  );
  const optionsById = new Map(withOpts.map((q) => [q.question.id, q.options]));

  return rows.map((row) => ({
    itemId: row.item.id,
    position: row.item.position,
    question: row.question,
    options: optionsById.get(row.question.id) ?? [],
    selectedOption: row.vote ?? null,
  }));
}

/** The item, only if it belongs to one of this user's sessions. */
export async function itemForUser(
  itemId: number,
  userId: string,
  database: Db = db,
): Promise<{ itemId: number; questionId: number; session: DailySessionRow } | null> {
  const [row] = await database
    .select({ item: dailySessionItems, session: dailySessions })
    .from(dailySessionItems)
    .innerJoin(dailySessions, eq(dailySessions.id, dailySessionItems.sessionId))
    .where(and(eq(dailySessionItems.id, itemId), eq(dailySessions.userId, userId)));
  return row ? { itemId: row.item.id, questionId: row.item.questionId, session: row.session } : null;
}

/** Dates of this user's completed sessions before `beforeDate`. */
export async function completedDatesBefore(userId: string, beforeDate: string, database: Db = db): Promise<string[]> {
  const rows = await database
    .select({ date: dailySessions.sessionDate })
    .from(dailySessions)
    .where(
      and(eq(dailySessions.userId, userId), eq(dailySessions.status, 'completed'), lt(dailySessions.sessionDate, beforeDate)),
    )
    .orderBy(desc(dailySessions.sessionDate));
  return rows.map((row) => row.date);
}

/** Mark completed only if still pending, so a double submit cannot overwrite the summary. */
export async function completeSession(
  sessionId: number,
  streakCount: number,
  completion: DailySessionCompletion,
  database: Db = db,
): Promise<boolean> {
  const updated = await database
    .update(dailySessions)
    .set({ status: 'completed', streakCount, completion, completedAt: new Date() })
    .where(and(eq(dailySessions.id, sessionId), eq(dailySessions.status, 'pending')))
    .returning({ id: dailySessions.id });
  return updated.length > 0;
}

/** The option positions this user chose in one session, for today's lean. */
export async function sessionVoteVectors(
  sessionId: number,
  userId: string,
  database: Db = db,
): Promise<Array<{ vector: OptionVector; weight: number }>> {
  const rows = await database
    .select({ option: policyQuestionOptions })
    .from(policyVotes)
    .innerJoin(dailySessionItems, eq(dailySessionItems.id, policyVotes.sessionItemId))
    .innerJoin(
      policyQuestionOptions,
      and(eq(policyQuestionOptions.questionId, policyVotes.questionId), eq(policyQuestionOptions.optionKey, policyVotes.optionKey)),
    )
    .where(and(eq(dailySessionItems.sessionId, sessionId), eq(policyVotes.userId, userId)));
  return rows.map((row) => ({ vector: vectorOf(row.option), weight: row.option.weight }));
}

/**
 * For one area on one day: how many people finished, and the weighted sum of every
 * chosen option's position per axis, across their session votes.
 */
export async function regionTotals(
  sessionDate: string,
  kind: 'county' | 'constituency',
  name: string,
  database: Db = db,
): Promise<{ finished: number; totals: Partial<Record<IdeologyDimension, number>> }> {
  const areaColumn = kind === 'county' ? dailySessions.county : dailySessions.constituency;
  const inArea = and(eq(dailySessions.sessionDate, sessionDate), eq(dailySessions.status, 'completed'), eq(areaColumn, name));

  const [finished] = await database.select({ n: count() }).from(dailySessions).where(inArea);

  const sums = Object.fromEntries(
    IDEOLOGY_DIMENSIONS.map((d) => [
      d,
      sql<number>`coalesce(sum(${policyQuestionOptions[d]} * ${policyQuestionOptions.weight}), 0)`.mapWith(Number),
    ]),
  ) as Record<IdeologyDimension, ReturnType<typeof sql<number>>>;

  const [row] = await database
    .select(sums)
    .from(policyVotes)
    .innerJoin(dailySessionItems, eq(dailySessionItems.id, policyVotes.sessionItemId))
    .innerJoin(dailySessions, eq(dailySessions.id, dailySessionItems.sessionId))
    .innerJoin(
      policyQuestionOptions,
      and(eq(policyQuestionOptions.questionId, policyVotes.questionId), eq(policyQuestionOptions.optionKey, policyVotes.optionKey)),
    )
    .where(inArea);

  return { finished: Number(finished?.n ?? 0), totals: (row ?? {}) as Partial<Record<IdeologyDimension, number>> };
}

// ---------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------

/** One answer per user per question: a second vote replaces the first. */
export async function upsertVote(
  input: { userId: string; questionId: number; optionKey: string; source: VoteSource; sessionItemId: number | null },
  database: Db = db,
): Promise<void> {
  await database
    .insert(policyVotes)
    .values(input)
    .onConflictDoUpdate({
      target: [policyVotes.userId, policyVotes.questionId],
      set: {
        optionKey: input.optionKey,
        source: input.source,
        sessionItemId: input.sessionItemId,
        updatedAt: new Date(),
      },
    });
}

export async function deleteVote(userId: string, questionId: number, database: Db = db): Promise<boolean> {
  const deleted = await database
    .delete(policyVotes)
    .where(and(eq(policyVotes.userId, userId), eq(policyVotes.questionId, questionId)))
    .returning({ id: policyVotes.id });
  return deleted.length > 0;
}

export async function tallies(questionIds: number[], database: Db = db): Promise<Map<number, QuestionTally>> {
  const result = new Map<number, QuestionTally>();
  if (questionIds.length === 0) return result;
  const rows = await database
    .select({ questionId: policyVotes.questionId, optionKey: policyVotes.optionKey, n: count() })
    .from(policyVotes)
    .where(inArray(policyVotes.questionId, questionIds))
    .groupBy(policyVotes.questionId, policyVotes.optionKey);
  for (const row of rows) {
    const tally = result.get(row.questionId) ?? { total: 0, byOption: {} };
    tally.byOption[row.optionKey] = Number(row.n);
    tally.total += Number(row.n);
    result.set(row.questionId, tally);
  }
  return result;
}

export async function userVote(userId: string, questionId: number, database: Db = db): Promise<string | null> {
  const [row] = await database
    .select({ optionKey: policyVotes.optionKey })
    .from(policyVotes)
    .where(and(eq(policyVotes.userId, userId), eq(policyVotes.questionId, questionId)));
  return row?.optionKey ?? null;
}

export interface UserVoteVector {
  questionId: number;
  optionKey: string;
  vector: OptionVector;
  weight: number;
  confidence: number | null;
  votedAt: Date;
}

export async function userVoteVectors(userId: string, since?: Date, database: Db = db): Promise<UserVoteVector[]> {
  const rows = await database
    .select({ vote: policyVotes, option: policyQuestionOptions })
    .from(policyVotes)
    .innerJoin(
      policyQuestionOptions,
      and(eq(policyQuestionOptions.questionId, policyVotes.questionId), eq(policyQuestionOptions.optionKey, policyVotes.optionKey)),
    )
    .where(since ? and(eq(policyVotes.userId, userId), gte(policyVotes.updatedAt, since)) : eq(policyVotes.userId, userId))
    .orderBy(asc(policyVotes.updatedAt));
  return rows.map(({ vote, option }) => ({
    questionId: vote.questionId,
    optionKey: vote.optionKey,
    vector: vectorOf(option),
    weight: option.weight,
    confidence: option.confidence,
    votedAt: vote.updatedAt,
  }));
}

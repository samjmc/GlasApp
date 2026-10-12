/**
 * Everything GlasApp holds about one user, as one JSON document (GDPR Art. 15 access and Art. 20
 * portability). It reads the same user-keyed tables as deleteUserData.ts; a new one must be added
 * here in the same change. The integration test scans the schema for tables with a `user_id` or
 * `subject_kind` column, so it catches a new table that follows that naming, not one keyed some
 * other way (`owner_id`, a child of a user table): those need a person to remember.
 *
 * What is left out on purpose: the phone code's hash and its bookkeeping (a secret, not the user's
 * data), the sign-in itself (held by Supabase), and the profile picture file (its address is in).
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db, type Db } from '../db';
import { publicProfile } from './profile';
import { users } from '@shared/schema/accounts';
import { pledgeCategoryPriorities } from '@shared/schema/pledges';
import { ideologyProfiles, quizResults } from '@shared/schema/quiz';
import { dailySessionItems, dailySessions, policyQuestionOptions, policyQuestions, policyVotes } from '@shared/schema/voting';

/** The politics tables the export reads, for the schema scan in the integration test to compare against. */
export const EXPORTED_USER_TABLES = [
  'users',
  'quiz_results',
  'ideology_profiles',
  'policy_votes',
  'daily_sessions',
  'daily_session_items',
  'pledge_category_priorities',
] as const;

export const EXPORT_FORMAT_VERSION = 1;

const NOTES = [
  'Your sign-in (your password, or your Google sign-in) is held by our sign-in provider, Supabase, and is not in this file. Your email address is.',
  'Your profile picture is not in this file; its address is in account.profileImageUrl.',
  'Timestamps are in UTC; a daily session\'s sessionDate is the Irish calendar day. The position on each quiz result and in ideologyProfile is one number from -10 to +10 on each of eight dimensions: economic, social, cultural, authority, environmental, welfare, globalism and technocratic.',
];

/** The profile as the app already shows it to its owner (publicProfile drops the phone code secrets), plus the email. */
type Account = ReturnType<typeof publicProfile> & { email: string | null };

export interface UserDataExport {
  format: number;
  exportedAt: string;
  /** Your account and profile. null when no profile row exists yet. */
  account: Account | null;
  quizResults: Array<Omit<typeof quizResults.$inferSelect, 'userId'>>;
  /** Your current political position, built from your quiz results and votes. */
  ideologyProfile: Omit<typeof ideologyProfiles.$inferSelect, 'subjectKind' | 'subjectId'> | null;
  /** Your vote on each question, with the question and the answer you chose in words. */
  votes: Array<{ questionId: number; question: string; optionKey: string; answer: string; source: string; votedAt: Date; changedAt: Date }>;
  /** Each daily session, with the questions it put to you in order. */
  dailySessions: Array<Omit<typeof dailySessions.$inferSelect, 'userId' | 'id'> & { questionIds: number[] }>;
  pledgePriorities: Array<{ category: string; rank: number; updatedAt: Date }>;
  notes: string[];
}

/** One user's data. `email` comes from the verified sign-in token, not from this database. */
export async function exportUserData(userId: string, identity: { email: string | null }, now = new Date(), database: Db = db): Promise<UserDataExport> {
  if (!userId) throw new Error('exportUserData needs a user id');

  const [profile] = await database.select().from(users).where(eq(users.id, userId));
  const quiz = await database
    .select()
    .from(quizResults)
    .where(eq(quizResults.userId, userId))
    .orderBy(desc(quizResults.createdAt), desc(quizResults.id));
  const [position] = await database
    .select()
    .from(ideologyProfiles)
    .where(and(eq(ideologyProfiles.subjectKind, 'user'), eq(ideologyProfiles.subjectId, userId)));
  const votes = await database
    .select({
      questionId: policyVotes.questionId,
      question: policyQuestions.question,
      optionKey: policyVotes.optionKey,
      answer: policyQuestionOptions.label,
      source: policyVotes.source,
      votedAt: policyVotes.createdAt,
      changedAt: policyVotes.updatedAt,
    })
    .from(policyVotes)
    .innerJoin(policyQuestions, eq(policyQuestions.id, policyVotes.questionId))
    .innerJoin(policyQuestionOptions, and(eq(policyQuestionOptions.questionId, policyVotes.questionId), eq(policyQuestionOptions.optionKey, policyVotes.optionKey)))
    .where(eq(policyVotes.userId, userId))
    .orderBy(asc(policyVotes.createdAt), asc(policyVotes.id));
  const sessions = await database.select().from(dailySessions).where(eq(dailySessions.userId, userId)).orderBy(asc(dailySessions.sessionDate));
  const items = sessions.length
    ? await database
        .select({ sessionId: dailySessionItems.sessionId, questionId: dailySessionItems.questionId })
        .from(dailySessionItems)
        .where(inArray(dailySessionItems.sessionId, sessions.map((s) => s.id)))
        .orderBy(asc(dailySessionItems.sessionId), asc(dailySessionItems.position))
    : [];
  const priorities = await database
    .select({ category: pledgeCategoryPriorities.category, rank: pledgeCategoryPriorities.rank, updatedAt: pledgeCategoryPriorities.updatedAt })
    .from(pledgeCategoryPriorities)
    .where(eq(pledgeCategoryPriorities.userId, userId))
    .orderBy(asc(pledgeCategoryPriorities.rank));

  return {
    format: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    account: profile ? { ...publicProfile(profile), email: identity.email } : null,
    quizResults: quiz.map(({ userId: _owner, ...rest }) => rest),
    ideologyProfile: position ? (({ subjectKind: _kind, subjectId: _id, ...rest }) => rest)(position) : null,
    votes,
    dailySessions: sessions.map(({ userId: _owner, id, ...rest }) => ({ ...rest, questionIds: items.filter((i) => i.sessionId === id).map((i) => i.questionId) })),
    pledgePriorities: priorities,
    notes: NOTES,
  };
}

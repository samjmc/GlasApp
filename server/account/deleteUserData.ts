/**
 * Erase one user's GlasApp data (GDPR right to erasure). Every politics table that holds a
 * row per user is listed here; a new user-keyed table must be added in the same change, and
 * deleteUserData.integration.test.ts fails if one is missed.
 *
 * The political opinions (quiz, votes, rankings, profile position) are erased on their own
 * when someone withdraws consent (consent.ts); the rest of the account stays.
 */
import { and, eq } from 'drizzle-orm';
import { db, type Db } from '../db';
import { dailySessions, policyVotes } from '@shared/schema/voting';
import { pledgeCategoryPriorities } from '@shared/schema/pledges';
import { ideologyProfiles, quizResults } from '@shared/schema/quiz';
import { users } from '@shared/schema/accounts';

export type PoliticalDataCounts = Record<
  'policyVotes' | 'dailySessions' | 'pledgeCategoryPriorities' | 'quizResults' | 'ideologyProfile',
  number
>;
export type DeletedCounts = PoliticalDataCounts & Record<'profile', number>;

/** The transaction handle drizzle passes to a `db.transaction` callback. */
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Deletes the rows that show a user's political opinions, inside the caller's transaction. */
export async function erasePoliticalData(tx: Tx, userId: string): Promise<PoliticalDataCounts> {
  const count = async (rows: Promise<unknown[]>) => (await rows).length;
  return {
    policyVotes: await count(tx.delete(policyVotes).where(eq(policyVotes.userId, userId)).returning({ id: policyVotes.id })),
    // daily_session_items cascade from their session.
    dailySessions: await count(tx.delete(dailySessions).where(eq(dailySessions.userId, userId)).returning({ id: dailySessions.id })),
    pledgeCategoryPriorities: await count(
      tx
        .delete(pledgeCategoryPriorities)
        .where(eq(pledgeCategoryPriorities.userId, userId))
        .returning({ userId: pledgeCategoryPriorities.userId }),
    ),
    quizResults: await count(tx.delete(quizResults).where(eq(quizResults.userId, userId)).returning({ id: quizResults.id })),
    ideologyProfile: await count(
      tx
        .delete(ideologyProfiles)
        .where(and(eq(ideologyProfiles.subjectKind, 'user'), eq(ideologyProfiles.subjectId, userId)))
        .returning({ id: ideologyProfiles.subjectId }),
    ),
  };
}

/** Deletes every row owned by `userId` in one transaction; all or nothing. */
export async function deleteUserData(userId: string, database: Db = db): Promise<DeletedCounts> {
  if (!userId) throw new Error('deleteUserData needs a user id');
  return database.transaction(async (tx) => {
    const political = await erasePoliticalData(tx, userId);
    // Name, county, bio and phone number: personal data, keyed by `id` rather than user_id.
    const profile = (await tx.delete(users).where(eq(users.id, userId)).returning({ id: users.id })).length;
    return { ...political, profile };
  });
}

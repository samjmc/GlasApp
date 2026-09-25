/**
 * Erase one user's GlasApp data (GDPR right to erasure). Every politics table that holds a
 * row per user is listed here; a new user-keyed table must be added in the same change, and
 * deleteUserData.integration.test.ts fails if one is missed.
 */
import { and, eq } from 'drizzle-orm';
import { db, type Db } from '../db';
import { dailySessions, policyVotes } from '@shared/schema/voting';
import { pledgeCategoryPriorities } from '@shared/schema/pledges';
import { ideologyProfiles, quizResults } from '@shared/schema/quiz';
import { users } from '@shared/schema/accounts';

export type DeletedCounts = Record<
  'policyVotes' | 'dailySessions' | 'pledgeCategoryPriorities' | 'quizResults' | 'ideologyProfile' | 'profile',
  number
>;

/** Deletes every row owned by `userId` in one transaction; all or nothing. */
export async function deleteUserData(userId: string, database: Db = db): Promise<DeletedCounts> {
  if (!userId) throw new Error('deleteUserData needs a user id');
  return database.transaction(async (tx) => {
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
      // Name, county, bio and phone number: personal data, keyed by `id` rather than user_id.
      profile: await count(tx.delete(users).where(eq(users.id, userId)).returning({ id: users.id })),
    };
  });
}

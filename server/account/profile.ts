/**
 * Reads and writes of the profile fields of politics.users. The consent columns are read and
 * written by consent.ts, the export reads the row in exportUserData.ts, and account deletion goes
 * through deleteUserData.ts.
 */
import { eq, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import { users, type UserRow } from '@shared/schema/accounts';

/** Profile fields a user may edit on their own row. */
export interface ProfileEdits {
  firstName?: string;
  lastName?: string;
  county?: string;
  bio?: string;
}

/** The row for this user, created on first sight: Supabase owns sign-up, so there is no other moment to create it. */
export async function ensureProfile(userId: string, database: Db = db): Promise<UserRow> {
  const [created] = await database.insert(users).values({ id: userId }).onConflictDoNothing().returning();
  if (created) return created;
  const [existing] = await database.select().from(users).where(eq(users.id, userId));
  return existing!;
}

export async function getProfile(userId: string, database: Db = db): Promise<UserRow | null> {
  const [row] = await database.select().from(users).where(eq(users.id, userId));
  return row ?? null;
}

export async function updateProfile(userId: string, edits: ProfileEdits, database: Db = db): Promise<UserRow> {
  await ensureProfile(userId, database);
  const [row] = await database.update(users).set({ ...edits, updatedAt: sql`now()` }).where(eq(users.id, userId)).returning();
  return row!;
}

export async function setProfileImage(userId: string, profileImageUrl: string, database: Db = db): Promise<void> {
  await ensureProfile(userId, database);
  await database.update(users).set({ profileImageUrl, updatedAt: sql`now()` }).where(eq(users.id, userId));
}

/**
 * What the client may see: never the code hash or its bookkeeping. Phone verification is gone,
 * but its columns are still on the row (no migration dropped them), so they stay out of the view.
 */
export function publicProfile(row: UserRow) {
  const { phoneCodeHash: _h, phoneCodeExpiresAt: _e, phoneCodeAttempts: _a, ...rest } = row;
  return rest;
}

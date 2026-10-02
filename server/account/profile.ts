/**
 * Every read and write of politics.users. Nothing else touches it; account deletion goes
 * through deleteUserData.ts.
 */
import { and, eq, ne, sql } from 'drizzle-orm';
import { db, type Db } from '../db';
import { users, type UserRow } from '@shared/schema/accounts';
import { checkCode, issuedRecently, type CheckResult, type IssuedCode } from './phone';

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

export type StartResult = 'started' | 'too_soon' | 'taken';

const NO_CODE = { phoneCodeHash: null, phoneCodeExpiresAt: null, phoneCodeAttempts: 0 } as const;

/**
 * Store a number (unverified) and a fresh code for it. A changed number is unverified until
 * its code comes back; re-sending for the same number just replaces the code.
 *
 * Only a VERIFIED holder owns a number. Another user's unverified claim is dropped, so nobody
 * can lock a stranger out of their own number by typing it in first.
 */
export async function startPhoneVerification(
  userId: string,
  phoneNumber: string,
  issued: IssuedCode,
  now = new Date(),
  database: Db = db,
): Promise<StartResult> {
  await ensureProfile(userId, database);
  return database.transaction(async (tx) => {
    const [own] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (issuedRecently(own!, now)) return 'too_soon';

    const others = await tx
      .select({ id: users.id, phoneVerified: users.phoneVerified })
      .from(users)
      .where(and(eq(users.phoneNumber, phoneNumber), ne(users.id, userId)))
      .for('update');
    if (others.some((o) => o.phoneVerified)) return 'taken';
    if (others.length) {
      await tx.update(users).set({ phoneNumber: null, ...NO_CODE }).where(and(eq(users.phoneNumber, phoneNumber), ne(users.id, userId)));
    }

    await tx
      .update(users)
      .set({
        phoneNumber,
        phoneVerified: false,
        phoneCodeHash: issued.hash,
        phoneCodeExpiresAt: issued.expiresAt,
        phoneCodeAttempts: 0,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId));
    return 'started';
  });
}

/**
 * Check a code against the stored one, under a row lock so two parallel guesses cannot both
 * be counted as the first. A wrong guess costs an attempt; a right one verifies and burns the code.
 */
export async function verifyPhone(userId: string, code: string, now = new Date(), database: Db = db): Promise<CheckResult> {
  return database.transaction(async (tx) => {
    const [row] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!row) return 'no_code';
    const result = checkCode(userId, row, code, now);
    if (result === 'wrong') {
      await tx.update(users).set({ phoneCodeAttempts: row.phoneCodeAttempts + 1 }).where(eq(users.id, userId));
    } else if (result === 'verified') {
      await tx
        .update(users)
        .set({ phoneVerified: true, ...NO_CODE, updatedAt: sql`now()` })
        .where(eq(users.id, userId));
    }
    return result;
  });
}

/** What the client may see: never the code hash or its bookkeeping. */
export function publicProfile(row: UserRow) {
  const { phoneCodeHash: _h, phoneCodeExpiresAt: _e, phoneCodeAttempts: _a, ...rest } = row;
  return rest;
}

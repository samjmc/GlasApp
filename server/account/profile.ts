/**
 * Reads and writes of the profile fields of politics.users, their one home (name, username, county,
 * constituency, bio, picture). The consent columns are read and
 * written by consent.ts, the export reads the row in exportUserData.ts, and account deletion goes
 * through deleteUserData.ts.
 */
import { eq, sql, type SQL } from 'drizzle-orm';
import { db, type Db } from '../db';
import { users, type UserRow } from '@shared/schema/accounts';
import { IMAGE_EXTENSIONS } from './profileImages';

/** Longest value each field may hold: the column for names and county, the PATCH limit for the bio. */
export const PROFILE_LIMITS = { firstName: 100, lastName: 100, username: 50, county: 50, constituency: 100, bio: 2000 } as const;

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

/** A self-edited text value, trimmed, or null when it is not a string, is blank or is longer than `max`. */
export const userText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;

/** Our own upload of this user's picture (routes/profileRoutes.ts names it), never any other address. */
function ownUpload(userId: string, value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(`/uploads/${userId}-`)) return null;
  const rest = value.slice(`/uploads/${userId}-`.length);
  return Object.values(IMAGE_EXTENSIONS).some((ext) => new RegExp(`^\\d+\\${ext}$`).test(rest)) ? value : null;
}

/**
 * The profile fields used to be saved to Supabase `user_metadata`. Copy into the row each one it has
 * never held (NULL) from the caller's verified token. Once, in effect: a field the user later clears
 * is saved as '' and is not copied back, and `coalesce` keeps a concurrent save from being overwritten.
 */
export async function backfillFromMetadata(row: UserRow, metadata: Record<string, unknown>, database: Db = db): Promise<UserRow> {
  const found = {
    firstName: userText(metadata.first_name, PROFILE_LIMITS.firstName) ?? userText(metadata.given_name, PROFILE_LIMITS.firstName),
    lastName: userText(metadata.last_name, PROFILE_LIMITS.lastName) ?? userText(metadata.family_name, PROFILE_LIMITS.lastName),
    username: userText(metadata.username, PROFILE_LIMITS.username),
    county: userText(metadata.county, PROFILE_LIMITS.county),
    constituency: userText(metadata.constituency, PROFILE_LIMITS.constituency),
    bio: userText(metadata.bio, PROFILE_LIMITS.bio),
    profileImageUrl: ownUpload(row.id, metadata.glas_avatar_url),
  };
  const copy = Object.fromEntries(
    (Object.keys(found) as (keyof typeof found)[])
      .filter((key) => row[key] === null && found[key] !== null)
      .map((key) => [key, sql`coalesce(${users[key]}, ${found[key]})`]),
  ) as Partial<Record<keyof typeof found, SQL>>;
  if (Object.keys(copy).length === 0) return row;
  const [updated] = await database.update(users).set(copy).where(eq(users.id, row.id)).returning();
  return updated ?? row;
}

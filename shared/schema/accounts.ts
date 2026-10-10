/**
 * Accounts: GlasApp's side of a user. Supabase Auth owns the account (email, password,
 * OAuth, role in app_metadata); this table holds only what the app itself needs, keyed by
 * the Supabase user id. It replaces the Replit-era `public.users`, which never existed in
 * GlasCore, so every signed-in profile request failed.
 */
import { sql } from 'drizzle-orm';
import { boolean, smallint, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { politics } from './politics';

export const users = politics.table(
  'users',
  {
    /** auth.users.id (UUID as text, like every other user_id in politics). */
    id: varchar('id', { length: 64 }).primaryKey(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    county: varchar('county', { length: 50 }),
    bio: text('bio'),
    profileImageUrl: text('profile_image_url'),
    /** E.164. Unique across users once set. */
    phoneNumber: varchar('phone_number', { length: 20 }),
    phoneVerified: boolean('phone_verified').notNull().default(false),
    /** sha256(user id + code). The code itself is never stored. */
    phoneCodeHash: varchar('phone_code_hash', { length: 64 }),
    phoneCodeExpiresAt: timestamp('phone_code_expires_at', { withTimezone: true }),
    /** Wrong guesses against the current code; it is burned at PHONE_CODE_MAX_ATTEMPTS. */
    phoneCodeAttempts: smallint('phone_code_attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_phone_number_idx').on(t.phoneNumber).where(sql`${t.phoneNumber} is not null`)],
);

export type UserRow = typeof users.$inferSelect;

/**
 * Explicit consent (GDPR Art. 9(2)(a)) to store a user's political opinions: quiz results,
 * votes, pledge priorities and the ideology profile built from them. Nothing of that is stored
 * without a row here for the current consent text. Withdrawing deletes the row and that data.
 */
export const politicalDataConsents = politics.table('political_data_consents', {
  userId: varchar('user_id', { length: 64 }).primaryKey(),
  /** The consent text agreed to (POLITICAL_CONSENT_VERSION in shared/consent.ts). */
  policyVersion: varchar('policy_version', { length: 32 }).notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
});

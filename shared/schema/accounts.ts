/**
 * Accounts: GlasApp's side of a user. Supabase Auth owns the account (email, password,
 * OAuth, role in app_metadata); this table holds only what the app itself needs, keyed by
 * the Supabase user id. It replaces the Replit-era `public.users`, which never existed in
 * GlasCore, so every signed-in profile request failed.
 */
import { sql } from 'drizzle-orm';
import { check, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { politics } from './politics';

export const users = politics.table(
  'users',
  {
    /** auth.users.id (UUID as text, like every other user_id in politics). */
    id: varchar('id', { length: 64 }).primaryKey(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    county: varchar('county', { length: 50 }),
    /** Both NULL until copied from the sign-in's user_metadata (server/account/profile.ts), where they were kept before. */
    username: varchar('username', { length: 50 }),
    /** The Dáil constituency the daily session is filed under (server/voting/routes.ts). */
    constituency: varchar('constituency', { length: 100 }),
    bio: text('bio'),
    profileImageUrl: text('profile_image_url'),
    /** When the person agreed to us processing their political opinions (GDPR Art. 9(2)(a)); null = not given or withdrawn. */
    politicalConsentAt: timestamp('political_consent_at', { withTimezone: true }),
    /** The wording they agreed to (shared/consent.ts POLITICAL_CONSENT_VERSION). */
    politicalConsentVersion: smallint('political_consent_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Given and withdrawn together (server/account/consent.ts): a time without a wording, or the reverse, is no consent.
    check('users_political_consent_chk', sql`(${t.politicalConsentAt} is null) = (${t.politicalConsentVersion} is null)`),
  ],
).enableRLS();

export type UserRow = typeof users.$inferSelect;

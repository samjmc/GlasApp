/**
 * Pledge tracking: promises, the evidence that decides their status, and each user's
 * ranking of which policy areas matter most to them.
 *
 * Replaces pledges, pledge_actions, party_performance_scores, pledge_category_weights,
 * user_category_votes, user_pledge_votes, user_category_rankings and policy_promises in
 * shared/schema.ts, none of which existed in the new database.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { politics } from './politics';
import { divisions } from './parliament';
import { EVIDENCE_KINDS, PLEDGE_CATEGORIES, PLEDGE_STATUSES } from '../pledges';

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

export const pledges = politics.table(
  'pledges',
  {
    id: serial('id').primaryKey(),
    /** Party name as it appears on politics.tds.party. */
    party: varchar('party', { length: 100 }).notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: varchar('category', { length: 30 }).notNull(),
    electionYear: smallint('election_year').notNull(),
    targetDate: date('target_date', { mode: 'string' }),
    status: varchar('status', { length: 20 }).notNull().default('unassessed'),
    statusNote: text('status_note'),
    /** Where the promise was made. Required: a pledge nobody can check is not recorded. */
    sourceUrl: text('source_url').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pledges_party_title_year_idx').on(sql`lower(${t.party})`, sql`lower(${t.title})`, t.electionYear),
    index('pledges_party_idx').on(sql`lower(${t.party})`),
    check('pledges_status_chk', sql`${t.status} in (${inList(PLEDGE_STATUSES)})`),
    check('pledges_category_chk', sql`${t.category} in (${inList(PLEDGE_CATEGORIES)})`),
  ],
);

export const pledgeEvidence = politics.table(
  'pledge_evidence',
  {
    id: serial('id').primaryKey(),
    pledgeId: integer('pledge_id')
      .notNull()
      .references(() => pledges.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 30 }).notNull(),
    summary: text('summary').notNull(),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    /** Required, like the pledge's own source. */
    sourceUrl: text('source_url').notNull(),
    /**
     * The recorded Dáil vote, when the evidence is one. The sync upserts divisions and
     * never deletes them, so SET NULL only fires on a manual delete.
     */
    divisionId: varchar('division_id', { length: 80 }).references(() => divisions.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pledge_evidence_pledge_idx').on(t.pledgeId, t.occurredOn),
    check('pledge_evidence_kind_chk', sql`${t.kind} in (${inList(EVIDENCE_KINDS)})`),
  ],
);

/** One user's ranking of policy areas: rank 1 is what matters most to them. */
export const pledgeCategoryPriorities = politics.table(
  'pledge_category_priorities',
  {
    id: serial('id').primaryKey(),
    /** auth.users id. */
    userId: varchar('user_id', { length: 255 }).notNull(),
    category: varchar('category', { length: 30 }).notNull(),
    rank: smallint('rank').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pledge_category_priorities_user_category_idx').on(t.userId, t.category),
    uniqueIndex('pledge_category_priorities_user_rank_idx').on(t.userId, t.rank),
    check('pledge_category_priorities_rank_chk', sql`${t.rank} >= 1`),
    check('pledge_category_priorities_category_chk', sql`${t.category} in (${inList(PLEDGE_CATEGORIES)})`),
  ],
);

export type PledgeRow = typeof pledges.$inferSelect;
export type NewPledge = typeof pledges.$inferInsert;
export type PledgeEvidenceRow = typeof pledgeEvidence.$inferSelect;
export type NewPledgeEvidence = typeof pledgeEvidence.$inferInsert;

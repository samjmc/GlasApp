/**
 * Quiz and ideology tables. Before this file there were five places a quiz result could
 * land and nine ideology tables, none of which had a schema.
 *
 * - `quiz_results`: every quiz a signed-in user completes. The newest is their quiz position;
 *   the rest is their history.
 * - `td_ideology_evidence`: one row per piece of evidence about a TD's position (an article
 *   stance, a debate speech). Append-only and idempotent on its source, so a TD's profile can
 *   always be rebuilt from it. Users have no evidence rows: their votes live in server/voting
 *   and are read through `listUserVoteVectors()`.
 * - `ideology_profiles`: the computed position of every user, TD and party. Derived; never
 *   the source of truth. `npm run ideology -- --recalculate` rebuilds all of it.
 *
 * All values follow shared/ideology.ts: −10..+10, + is the right-coded pole.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { politics, tds } from './politics';
import type { QuizResponse } from '../quiz';

const vectorColumns = () => ({
  economic: real('economic').notNull(),
  social: real('social').notNull(),
  cultural: real('cultural').notNull(),
  authority: real('authority').notNull(),
  environmental: real('environmental').notNull(),
  welfare: real('welfare').notNull(),
  globalism: real('globalism').notNull(),
  technocratic: real('technocratic').notNull(),
});

/** NULL = this evidence says nothing about that dimension. Never read NULL as 0. */
const partialVectorColumns = () => ({
  economic: real('economic'),
  social: real('social'),
  cultural: real('cultural'),
  authority: real('authority'),
  environmental: real('environmental'),
  welfare: real('welfare'),
  globalism: real('globalism'),
  technocratic: real('technocratic'),
});

export const quizResults = politics.table(
  'quiz_results',
  {
    id: serial('id').primaryKey(),
    /** Supabase auth user id. */
    userId: varchar('user_id', { length: 255 }).notNull(),
    answers: jsonb('answers').$type<QuizResponse[]>().notNull(),
    ...vectorColumns(),
    ideology: text('ideology').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('quiz_results_user_created_idx').on(t.userId, t.createdAt)],
);

/** `article` = the deleted scoring panel's rows, kept only until `npm run stances -- --rebuild` purges them. */
export const EVIDENCE_SOURCES = ['article', 'debate', 'stance'] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export const tdIdeologyEvidence = politics.table(
  'td_ideology_evidence',
  {
    id: serial('id').primaryKey(),
    tdId: integer('td_id')
      .notNull()
      .references(() => tds.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 20 }).notNull(),
    /** Identifies the source item, e.g. "question:123" for a stance or a debate speech id. */
    sourceRef: text('source_ref').notNull(),
    policyTopic: text('policy_topic'),
    ...partialVectorColumns(),
    /** Evidence strength before time decay, > 0. */
    weight: real('weight').notNull(),
    /** When the stance was taken (article date, debate date), for time decay. */
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('td_ideology_evidence_source_idx').on(t.tdId, t.source, t.sourceRef),
    index('td_ideology_evidence_td_idx').on(t.tdId, t.observedAt),
    check('td_ideology_evidence_source_chk', sql`${t.source} in ('article', 'debate', 'stance')`),
    check('td_ideology_evidence_weight_chk', sql`${t.weight} > 0`),
  ],
);

export const PROFILE_SUBJECTS = ['user', 'td', 'party'] as const;
export type ProfileSubject = (typeof PROFILE_SUBJECTS)[number];

export const ideologyProfiles = politics.table(
  'ideology_profiles',
  {
    subjectKind: varchar('subject_kind', { length: 10 }).notNull(),
    /** User id, tds.id as text, or the party name. */
    subjectId: text('subject_id').notNull(),
    ...vectorColumns(),
    /** Sum of the (decayed) evidence weight behind the position, excluding the prior. */
    totalWeight: real('total_weight').notNull(),
    evidenceCount: integer('evidence_count').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.subjectKind, t.subjectId] }),
    check('ideology_profiles_subject_chk', sql`${t.subjectKind} in ('user', 'td', 'party')`),
  ],
);

export type QuizResultRow = typeof quizResults.$inferSelect;
export type TdIdeologyEvidenceRow = typeof tdIdeologyEvidence.$inferSelect;
export type NewTdIdeologyEvidence = typeof tdIdeologyEvidence.$inferInsert;
export type IdeologyProfileRow = typeof ideologyProfiles.$inferSelect;

/**
 * Quiz and ideology tables. Before this file there were five places a quiz result could
 * land and nine ideology tables, none of which had a schema.
 *
 * - `quiz_results`: every quiz a signed-in user completes. The newest is their quiz position;
 *   the rest is their history.
 * - `td_ideology_evidence`: one row per piece of evidence about a TD's position (a news stance,
 *   a debate speech, a Dáil vote that was the TD's own). Idempotent on its source, so a TD's
 *   profile can always be rebuilt from it: stance rows are upserted (the current answer);
 *   division rows are derived from `division_ideology` and replaced nightly; other rows are
 *   append-only. Users have no evidence rows: their votes live in server/voting and are read
 *   through `listUserVoteVectors()`.
 * - `division_ideology`: what each Dáil division meant, as a model read it. A cache of model
 *   output, keyed by the division; no user data.
 * - `ideology_profiles`: the computed position of every user, TD and party. Derived; never
 *   the source of truth. `npm run ideology -- --recalculate` rebuilds all of it.
 *
 * All values follow shared/ideology.ts: −10..+10, + is the right-coded pole.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { politics, tds } from './politics';
import { divisions } from './parliament';
import { inList } from './pledges';
import { DIVISION_KINDS, DIVISION_MEANING_STATUSES, type DivisionKind, type DivisionMeaningStatus } from '../divisionMeaning';
import type { IdeologyDimension } from '../ideology';
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

/**
 * `article` = the deleted scoring panel's rows, kept only until `npm run stances -- --rebuild` purges them.
 * `division` = a Dáil vote that was the TD's own, derived from `division_ideology` (never recorded one by one).
 */
export const EVIDENCE_SOURCES = ['article', 'debate', 'stance', 'division'] as const;
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
    check('td_ideology_evidence_source_chk', sql`${t.source} in (${inList(EVIDENCE_SOURCES)})`),
    check('td_ideology_evidence_weight_chk', sql`${t.weight} > 0`),
  ],
);

/** A lean per dimension, −2..+2 (shared/ideology.ts's sign rule); a dimension left out says nothing. */
export type DivisionLean = Partial<Record<IdeologyDimension, number>>;

/**
 * What one Dáil division meant: one model reading per division, reused until the prompt
 * (`prompt_version`) or the division's own record (`input_hash`) changes. Every reading
 * column is NULL unless `status` is 'classified' or 'no_signal'.
 */
export const divisionIdeology = politics.table(
  'division_ideology',
  {
    divisionId: varchar('division_id', { length: 80 })
      .primaryKey()
      .references(() => divisions.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 12 }).$type<DivisionMeaningStatus>().notNull(),
    taLean: jsonb('ta_lean').$type<DivisionLean>(),
    nilLean: jsonb('nil_lean').$type<DivisionLean>(),
    /** 0..1: how much a Níl vote says about the voter. */
    nilWeight: real('nil_weight'),
    confidence: real('confidence'),
    salience: real('salience'),
    divisionKind: varchar('division_kind', { length: 20 }).$type<DivisionKind>(),
    procedural: boolean('procedural'),
    freeVote: boolean('free_vote'),
    policyTopic: text('policy_topic'),
    taMeans: text('ta_means'),
    reasoning: text('reasoning'),
    /** The model that answered (the provider can replace the one asked for). */
    model: varchar('model', { length: 60 }),
    promptVersion: smallint('prompt_version').notNull(),
    /** Hash of the division's subject, debate, section, position and tallies when it was read. */
    inputHash: varchar('input_hash', { length: 16 }).notNull(),
    /** Model calls made for this prompt version and input; a failed reading is retried up to a cap. */
    attempts: smallint('attempts').notNull().default(0),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    classifiedAt: timestamp('classified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('division_ideology_status_chk', sql`${t.status} in (${inList(DIVISION_MEANING_STATUSES)})`),
    check('division_ideology_kind_chk', sql`${t.divisionKind} in (${inList(DIVISION_KINDS)})`),
    check('division_ideology_nil_weight_chk', sql`${t.nilWeight} between 0 and 1`),
    check('division_ideology_confidence_chk', sql`${t.confidence} between 0 and 1`),
    check('division_ideology_salience_chk', sql`${t.salience} between 0 and 1`),
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
export type DivisionIdeologyRow = typeof divisionIdeology.$inferSelect;
export type NewDivisionIdeology = typeof divisionIdeology.$inferInsert;

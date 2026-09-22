/**
 * Voting tables: policy questions made from news, the daily session, and the votes.
 *
 * Every vote lives in ONE table, `policy_votes`, whichever surface cast it. The old design
 * wrote each vote to four tables (daily_session_votes, user_policy_votes,
 * user_policy_vote_responses, user_ideology_profiles) and none of them had a schema.
 *
 * Tallies are queries over `policy_votes`, not stored counters. A user's ideology profile
 * belongs to the quiz/ideology domain, which reads votes through
 * `listUserVoteVectors()` in server/voting and never through these tables.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { politics } from './politics';
import type { DailySessionCompletion } from '../voting';

// ---------------------------------------------------------------------------
// A question made from one news article. The headline, summary, link and image are a
// copy taken when the question is made, so voting never reads the news tables.
// ---------------------------------------------------------------------------
export const policyQuestions = politics.table(
  'policy_questions',
  {
    id: serial('id').primaryKey(),
    /** news_articles.id. Not a foreign key: news is another domain. */
    articleId: integer('article_id').notNull(),
    question: text('question').notNull(),
    /** A key of POLICY_DOMAINS in server/constants/policyTopics.ts, or 'other'. */
    policyDomain: varchar('policy_domain', { length: 40 }).notNull(),
    policyTopic: varchar('policy_topic', { length: 80 }).notNull(),
    /** The ideology axis the question was built to reveal. NULL when the model named none. */
    primaryDimension: varchar('primary_dimension', { length: 20 }),
    confidence: real('confidence'),
    rationale: text('rationale'),
    headline: text('headline').notNull(),
    summary: text('summary'),
    articleUrl: text('article_url'),
    imageUrl: text('image_url'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('policy_questions_article_idx').on(t.articleId),
    index('policy_questions_created_idx').on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// The three or four answers to a question. Each carries where choosing it places a
// person on the eight axes, −2..+2 (0 = says nothing about that axis). One column per
// axis rather than jsonb, so the positions are queryable and constrained.
// ---------------------------------------------------------------------------
export const policyQuestionOptions = politics.table(
  'policy_question_options',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .notNull()
      .references(() => policyQuestions.id, { onDelete: 'cascade' }),
    optionKey: varchar('option_key', { length: 12 }).notNull(),
    label: text('label').notNull(),
    position: smallint('position').notNull(),
    economic: real('economic').notNull().default(0),
    social: real('social').notNull().default(0),
    cultural: real('cultural').notNull().default(0),
    authority: real('authority').notNull().default(0),
    environmental: real('environmental').notNull().default(0),
    welfare: real('welfare').notNull().default(0),
    globalism: real('globalism').notNull().default(0),
    technocratic: real('technocratic').notNull().default(0),
    /** How strongly choosing this option expresses its position, 0.1..3. */
    weight: real('weight').notNull().default(1),
    /** The model's confidence in the positions, 0..1. NULL when it gave none. */
    confidence: real('confidence'),
  },
  (t) => [
    // A table constraint, not a unique index: policy_votes' composite foreign key needs
    // it to exist inside CREATE TABLE, and drizzle-kit emits indexes after foreign keys.
    unique('policy_question_options_key_uniq').on(t.questionId, t.optionKey),
    check(
      'policy_question_options_range_chk',
      sql`${t.economic} between -2 and 2 and ${t.social} between -2 and 2
        and ${t.cultural} between -2 and 2 and ${t.authority} between -2 and 2
        and ${t.environmental} between -2 and 2 and ${t.welfare} between -2 and 2
        and ${t.globalism} between -2 and 2 and ${t.technocratic} between -2 and 2
        and ${t.weight} between 0.1 and 3`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// One daily session per user per day. The completion summary is frozen when the user
// finishes, so reopening a finished session shows exactly what they saw.
// ---------------------------------------------------------------------------
export const dailySessions = politics.table(
  'daily_sessions',
  {
    id: serial('id').primaryKey(),
    /** auth.users id. */
    userId: varchar('user_id', { length: 255 }).notNull(),
    sessionDate: date('session_date', { mode: 'string' }).notNull(),
    status: varchar('status', { length: 12 }).notNull().default('pending'),
    county: varchar('county', { length: 60 }),
    constituency: varchar('constituency', { length: 100 }),
    /**
     * The user's ideology profile when the session was created, as the ideology domain
     * reported it. Completion compares it with the profile after the votes, so the shift
     * shown is the ideology domain's own arithmetic, never a second copy of it.
     * NULL when no profile existed yet.
     */
    profileBefore: jsonb('profile_before').$type<Record<string, number>>(),
    /** Set on completion. */
    streakCount: integer('streak_count'),
    completion: jsonb('completion').$type<DailySessionCompletion>(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('daily_sessions_user_date_idx').on(t.userId, t.sessionDate),
    index('daily_sessions_date_county_idx').on(t.sessionDate, t.county),
    index('daily_sessions_date_constituency_idx').on(t.sessionDate, t.constituency),
    check('daily_sessions_status_chk', sql`${t.status} in ('pending', 'completed')`),
  ],
);

export const dailySessionItems = politics.table(
  'daily_session_items',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => dailySessions.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => policyQuestions.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
  },
  (t) => [
    uniqueIndex('daily_session_items_question_idx').on(t.sessionId, t.questionId),
    uniqueIndex('daily_session_items_position_idx').on(t.sessionId, t.position),
  ],
);

// ---------------------------------------------------------------------------
// Every vote, from every surface. One answer per user per question; voting again
// replaces it. The composite foreign key makes an unknown option impossible to store.
// ---------------------------------------------------------------------------
export const policyVotes = politics.table(
  'policy_votes',
  {
    id: serial('id').primaryKey(),
    /** auth.users id. */
    userId: varchar('user_id', { length: 255 }).notNull(),
    questionId: integer('question_id').notNull(),
    optionKey: varchar('option_key', { length: 12 }).notNull(),
    source: varchar('source', { length: 20 }).notNull(),
    sessionItemId: integer('session_item_id').references(() => dailySessionItems.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('policy_votes_user_question_idx').on(t.userId, t.questionId),
    index('policy_votes_question_idx').on(t.questionId),
    index('policy_votes_user_created_idx').on(t.userId, t.createdAt),
    foreignKey({
      name: 'policy_votes_option_fk',
      columns: [t.questionId, t.optionKey],
      foreignColumns: [policyQuestionOptions.questionId, policyQuestionOptions.optionKey],
    }).onDelete('cascade'),
    check('policy_votes_source_chk', sql`${t.source} in ('daily_session', 'article')`),
  ],
);

export type PolicyQuestionRow = typeof policyQuestions.$inferSelect;
export type NewPolicyQuestion = typeof policyQuestions.$inferInsert;
export type PolicyQuestionOptionRow = typeof policyQuestionOptions.$inferSelect;
export type NewPolicyQuestionOption = typeof policyQuestionOptions.$inferInsert;
export type DailySessionRow = typeof dailySessions.$inferSelect;
export type DailySessionItemRow = typeof dailySessionItems.$inferSelect;
export type PolicyVoteRow = typeof policyVotes.$inferSelect;

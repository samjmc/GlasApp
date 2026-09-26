/**
 * GlasApp tables, all inside the `politics` Postgres schema.
 *
 * The Supabase project (GlasCore) is shared with GlasIntelligence, whose tables live in
 * `public`. Keeping GlasApp's tables in their own schema means the two apps can never
 * collide on a table name and grants can be managed per app.
 *
 * This file declares the schema and holds the scoring tables. Each other domain has its
 * own file beside it (voting.ts, ...) that imports `politics` from here and never
 * declares a second pgSchema('politics'). `npm run db:generate` reads every file in
 * shared/schema/ (see drizzle.config.ts) and turns them into one migration.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const politics = pgSchema('politics');

// ---------------------------------------------------------------------------
// TDs: who they are. Profile data only, no scores.
// ---------------------------------------------------------------------------
export const tds = politics.table(
  'tds',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    party: varchar('party', { length: 100 }),
    constituency: varchar('constituency', { length: 100 }),
    imageUrl: text('image_url'),
    /** Oireachtas member code, e.g. "Mary-Lou-McDonald.D.2011-03-09". */
    memberCode: varchar('member_code', { length: 120 }),
    memberUri: text('member_uri'),
    gender: varchar('gender', { length: 20 }),
    isActive: boolean('is_active').notNull().default(true),
    /** Ministerial or party offices held, as [{ title, since }]. */
    offices: jsonb('offices').$type<Array<{ title: string; since?: string }>>(),
    committees: jsonb('committees').$type<string[]>(),
    questionCountOral: integer('question_count_oral'),
    questionCountWritten: integer('question_count_written'),
    /** Vote attendance, 0–100. NULL means no data, never 0. */
    attendancePct: real('attendance_pct'),
    /** Committee attendance, 0–100. NULL below 10 eligible sittings or with no committee. */
    committeeAttendancePct: real('committee_attendance_pct'),
    bio: text('bio'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('tds_name_lower_idx').on(sql`lower(${t.name})`),
    uniqueIndex('tds_member_code_idx').on(t.memberCode),
    index('tds_party_idx').on(t.party),
    index('tds_constituency_idx').on(t.constituency),
  ],
);

// ---------------------------------------------------------------------------
// Scores: one row per TD, derived from the Oireachtas facts by server/scoring/rollup.ts
// and stored for fast reads.
// ---------------------------------------------------------------------------
export const tdScores = politics.table(
  'td_scores',
  {
    tdId: integer('td_id')
      .primaryKey()
      .references(() => tds.id, { onDelete: 'cascade' }),

    /** Derived 0–100. NULL until the rollup has run or when no pillar has data. */
    overallScore: smallint('overall_score'),
    parliamentaryScore: smallint('parliamentary_score'),
    debateScore: smallint('debate_score'),

    nationalRank: integer('national_rank'),
    partyRank: integer('party_rank'),
    constituencyRank: integer('constituency_rank'),

    /** When the rollup last wrote this row. NULL until it has. */
    computedAt: timestamp('computed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('td_scores_overall_score_idx').on(t.overallScore)],
);

// ---------------------------------------------------------------------------
// Article ↔ TD: this TD is named in this article. A fact, not a verdict.
// ---------------------------------------------------------------------------
export const articleTds = politics.table(
  'article_tds',
  {
    /** news_articles.id; not a foreign key because news lives in another domain. */
    articleId: integer('article_id').notNull(),
    tdId: integer('td_id')
      .notNull()
      .references(() => tds.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.tdId] }),
    index('article_tds_td_created_idx').on(t.tdId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Policy stances the old scoring panel extracted. Nothing writes it; part 3
// (docs/plans/td-stances.md) replaces it.
// ---------------------------------------------------------------------------
export const tdPolicyStances = politics.table(
  'td_policy_stances',
  {
    id: serial('id').primaryKey(),
    articleId: integer('article_id').notNull(),
    tdId: integer('td_id')
      .notNull()
      .references(() => tds.id, { onDelete: 'cascade' }),
    stance: varchar('stance', { length: 20 }).notNull(),
    stanceStrength: smallint('stance_strength'),
    evidence: text('evidence'),
    policyTopic: text('policy_topic'),
    policyDimension: varchar('policy_dimension', { length: 40 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('td_policy_stances_article_td_idx').on(t.articleId, t.tdId),
    index('td_policy_stances_td_idx').on(t.tdId),
  ],
);

// ---------------------------------------------------------------------------
// AI-researched historical baselines. Research content; not part of the formula.
// ---------------------------------------------------------------------------
export const tdHistoricalBaselines = politics.table(
  'td_historical_baselines',
  {
    id: serial('id').primaryKey(),
    tdId: integer('td_id')
      .notNull()
      .references(() => tds.id, { onDelete: 'cascade' }),
    baselineScore: smallint('baseline_score'),
    confidence: real('confidence'),
    category: varchar('category', { length: 50 }),
    historicalSummary: text('historical_summary'),
    keyFindings: jsonb('key_findings').$type<string[]>(),
    reasoning: text('reasoning'),
    controversiesNoted: jsonb('controversies_noted').$type<string[]>(),
    researchDate: timestamp('research_date', { withTimezone: true }),
    analyzedBy: varchar('analyzed_by', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('td_historical_baselines_td_idx').on(t.tdId)],
);

export type Td = typeof tds.$inferSelect;
export type NewTd = typeof tds.$inferInsert;
export type TdScoreRow = typeof tdScores.$inferSelect;
export type TdHistoricalBaselineRow = typeof tdHistoricalBaselines.$inferSelect;

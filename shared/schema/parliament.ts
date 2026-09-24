/**
 * Parliament tables: Dáil divisions, how each member voted, debate sections and speeches,
 * and the per-TD counts derived from them. Filled only by server/parliament/sync.ts from
 * api.oireachtas.ie; read by /api/parliament and the scoring pillars.
 *
 * Member codes (e.g. "Seán-Canney.D.2016-10-03") are the Oireachtas's own stable ids and
 * are kept on every row, so votes and speeches by someone not (yet) in `tds` are stored
 * and linked by `td_id` on the next roster sync instead of being dropped.
 */
import { boolean, date, index, integer, jsonb, primaryKey, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { politics, tds } from './politics';

/** How a member voted in a division. Absence is the lack of a row, not a value. */
export const divisionVote = politics.enum('division_vote', ['ta', 'nil', 'staon']);
export type DivisionVote = (typeof divisionVote.enumValues)[number];

// ---------------------------------------------------------------------------
// Divisions: one row per recorded Dáil vote.
// ---------------------------------------------------------------------------
export const divisions = politics.table(
  'divisions',
  {
    /** `dail-<houseNo>-<date>-<voteId>`, e.g. "dail-34-2025-06-25-vote_91". */
    id: varchar('id', { length: 80 }).primaryKey(),
    uri: text('uri').notNull().unique(),
    houseNo: smallint('house_no').notNull(),
    date: date('date').notNull(),
    heldAt: timestamp('held_at', { withTimezone: true }),
    subject: text('subject'),
    /** "Carried" | "Lost" | … as the Oireachtas reports it. */
    outcome: varchar('outcome', { length: 40 }),
    debateTitle: text('debate_title'),
    /** debate_sections.id when the section has been ingested; not a foreign key. */
    debateSectionId: varchar('debate_section_id', { length: 80 }),
    isBill: boolean('is_bill').notNull().default(false),
    taCount: integer('ta_count').notNull(),
    nilCount: integer('nil_count').notNull(),
    staonCount: integer('staon_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('divisions_date_idx').on(t.date)],
);

export const divisionVotes = politics.table(
  'division_votes',
  {
    divisionId: varchar('division_id', { length: 80 })
      .notNull()
      .references(() => divisions.id, { onDelete: 'cascade' }),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    vote: divisionVote('vote').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.divisionId, t.memberCode] }),
    index('division_votes_td_idx').on(t.tdId),
    index('division_votes_member_idx').on(t.memberCode),
  ],
);

// ---------------------------------------------------------------------------
// Debates: sections of the Dáil Official Report, and the speeches in them.
// ---------------------------------------------------------------------------
export const debateSections = politics.table(
  'debate_sections',
  {
    /** `dail-<date>-<eId>`, e.g. "dail-2025-06-25-dbsect_19". */
    id: varchar('id', { length: 80 }).primaryKey(),
    date: date('date').notNull(),
    title: text('title').notNull(),
    /** Ancestor section's id for nested sections. */
    parentId: varchar('parent_id', { length: 80 }),
    speechCount: integer('speech_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('debate_sections_date_idx').on(t.date)],
);

export const debateSpeeches = politics.table(
  'debate_speeches',
  {
    /** `<section id>/<speech eId>`. */
    id: varchar('id', { length: 120 }).primaryKey(),
    sectionId: varchar('section_id', { length: 80 })
      .notNull()
      .references(() => debateSections.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    /** Order within the section, from 0. */
    position: integer('position').notNull(),
    /** NULL for speakers who are not members (e.g. unattributed interjections). */
    memberCode: varchar('member_code', { length: 120 }),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    /** The role the speaker spoke in, e.g. "Minister for Health", when the record gives one. */
    role: text('role'),
    /** Spoken from the chair. Excluded from participation: the chair speaks in nearly every section. */
    isPresiding: boolean('is_presiding').notNull().default(false),
    text: text('text').notNull(),
    wordCount: integer('word_count').notNull(),
  },
  (t) => [
    index('debate_speeches_section_idx').on(t.sectionId, t.position),
    index('debate_speeches_td_idx').on(t.tdId, t.date),
    index('debate_speeches_member_idx').on(t.memberCode),
  ],
);

// ---------------------------------------------------------------------------
// Per-TD parliament record, recomputed by every sync. NULL means "not measurable",
// never zero: see server/parliament/metrics.ts.
// ---------------------------------------------------------------------------
export const tdParliamentStats = politics.table('td_parliament_stats', {
  tdId: integer('td_id')
    .primaryKey()
    .references(() => tds.id, { onDelete: 'cascade' }),
  /** Start of the TD's membership of the current Dáil; the window every count below uses. */
  memberSince: date('member_since').notNull(),
  /** Holds the chair (Ceann Comhairle), who does not vote. */
  isPresiding: boolean('is_presiding').notNull().default(false),
  divisionsEligible: integer('divisions_eligible').notNull(),
  votesCast: integer('votes_cast').notNull(),
  sittingDays: integer('sitting_days').notNull(),
  /** Distinct debate sections spoken in, chair speeches excluded. */
  sectionsSpoken: integer('sections_spoken').notNull(),
  speeches: integer('speeches').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// How far each feed has been ingested; the next sync starts from here.
// ---------------------------------------------------------------------------
export const parliamentSyncState = politics.table('parliament_sync_state', {
  /** 'divisions' | 'debates' | 'roster' */
  feed: varchar('feed', { length: 20 }).primaryKey(),
  /** Last date fully ingested. NULL = never. */
  throughDate: date('through_date'),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }).notNull().defaultNow(),
  lastResult: text('last_result'),
  /**
   * Days that could not be ingested → failed attempts so far. Retried each run until
   * MAX_DAY_ATTEMPTS, then left here for a person to look at. A bad day never blocks the
   * days after it.
   */
  failures: jsonb('failures').$type<Record<string, number>>().notNull().default({}),
});

export type DivisionRow = typeof divisions.$inferSelect;
export type NewDivision = typeof divisions.$inferInsert;
export type NewDivisionVote = typeof divisionVotes.$inferInsert;
export type DebateSectionRow = typeof debateSections.$inferSelect;
export type NewDebateSection = typeof debateSections.$inferInsert;
export type NewDebateSpeech = typeof debateSpeeches.$inferInsert;
export type TdParliamentStatsRow = typeof tdParliamentStats.$inferSelect;

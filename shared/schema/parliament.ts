/**
 * Parliament tables: Dáil divisions, how each member voted, debate sections and speeches,
 * and the per-TD counts derived from them. Filled only by server/parliament/sync.ts from
 * api.oireachtas.ie; read by /api/parliament and the scoring pillars.
 *
 * Member codes (e.g. "Seán-Canney.D.2016-10-03") are the Oireachtas's own stable ids and
 * are kept on every row, so votes and speeches by someone not (yet) in `tds` are stored
 * and linked by `td_id` on the next roster sync instead of being dropped.
 */
import { boolean, date, index, integer, jsonb, primaryKey, real, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core';
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
  /**
   * Sittings of the TD's own committees held while they were a member, and how many of those
   * the roll call lists them at. Nullable: rows from before committees were ingested have none.
   */
  committeeSittingsEligible: integer('committee_sittings_eligible'),
  committeeSittingsAttended: integer('committee_sittings_attended'),
  /**
   * Divisions left out of `divisions_eligible` for a reason, so a TD is never counted absent
   * when they could not vote: in the chair (the chair cannot vote), or on documented leave.
   */
  divisionsChaired: integer('divisions_chaired'),
  divisionsExcused: integer('divisions_excused'),
  /**
   * Eligible divisions held while the TD was in a leadership role: government office (cabinet
   * or Minister of State) or leader of a party. Those divisions have their own benchmark.
   */
  divisionsInLeadership: integer('divisions_in_leadership'),
  /** Sitting days left out of `sitting_days` because of documented leave. */
  sittingDaysExcused: integer('sitting_days_excused'),
  /**
   * The question benchmark pro-rated to the time the TD was expected to ask questions: not in
   * government office or the chair, not on documented leave. NULL = not expected to ask.
   */
  questionsExpected: real('questions_expected'),
  /** The vote-attendance benchmark for this TD's mix of backbench and government time. */
  attendanceBenchmark: real('attendance_benchmark'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Offices held in the current Dáil, past and present, from the roster. Government office
// changes what a TD is expected to do: ministers answer questions, they do not ask them.
// ---------------------------------------------------------------------------
export const officeType = politics.enum('office_type', [
  'cabinet',
  'minister_of_state',
  'ceann_comhairle',
  'leas_cheann_comhairle',
  'other',
]);
export type OfficeType = (typeof officeType.enumValues)[number];

export const tdOffices = politics.table(
  'td_offices',
  {
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    officeType: officeType('office_type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
  },
  (t) => [primaryKey({ columns: [t.memberCode, t.title, t.startDate] }), index('td_offices_td_idx').on(t.tdId)],
);

// ---------------------------------------------------------------------------
// Party leaders: the Oireachtas records no party leadership, so it is kept in
// server/parliament/partyLeaders.ts, each period dated and sourced, and loaded by every sync.
// Leaders of every party are treated alike, government or opposition.
// ---------------------------------------------------------------------------
export const tdPartyLeaders = politics.table(
  'td_party_leaders',
  {
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    party: text('party').notNull(),
    startDate: date('start_date').notNull(),
    /** NULL while still leader. */
    endDate: date('end_date'),
    sourceUrl: text('source_url').notNull(),
  },
  (t) => [primaryKey({ columns: [t.memberCode, t.startDate] }), index('td_party_leaders_td_idx').on(t.tdId)],
);

// ---------------------------------------------------------------------------
// Documented absences: leave a TD or their party announced publicly, each with its source.
// Kept in server/parliament/absences.json (reviewed in git) and loaded by every sync. The
// Oireachtas records no reason for an absence, so nothing here is ever inferred.
// ---------------------------------------------------------------------------
export const absenceReason = politics.enum('absence_reason', ['parental_leave', 'medical_leave', 'bereavement', 'other_leave']);
export type AbsenceReason = (typeof absenceReason.enumValues)[number];

export const tdAbsences = politics.table(
  'td_absences',
  {
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    startDate: date('start_date').notNull(),
    /** NULL while the leave is ongoing. */
    endDate: date('end_date'),
    reason: absenceReason('reason').notNull(),
    sourceUrl: text('source_url').notNull(),
    note: text('note'),
  },
  (t) => [primaryKey({ columns: [t.memberCode, t.startDate] }), index('td_absences_td_idx').on(t.tdId)],
);

// ---------------------------------------------------------------------------
// Every Oireachtas PDF read, one row per file: which period it covers and which printed names
// matched no current TD. A file is read once; a month whose file had an unmatched name is not
// taken as "not paid" for a TD with no row in it.
// ---------------------------------------------------------------------------
export const disclosureFiles = politics.table(
  'disclosure_files',
  {
    sourceUrl: text('source_url').primaryKey(),
    /** "interests" | "allowances". */
    kind: varchar('kind', { length: 20 }).notNull(),
    /** First day of the year (interests) or month (allowances) the file covers. */
    period: date('period').notNull(),
    unmatched: jsonb('unmatched').$type<string[]>().notNull().default([]),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('disclosure_files_kind_period_idx').on(t.kind, t.period)],
);

// ---------------------------------------------------------------------------
// Register of Members' Interests (annual PDF, Ethics in Public Office Acts): what each TD
// declared in each of the nine statutory categories. NULL text = declared nothing.
// ---------------------------------------------------------------------------
export const tdInterests = politics.table(
  'td_interests',
  {
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    /** The year the register covers (the 2025 register is published in early 2026). */
    registerYear: smallint('register_year').notNull(),
    /** 1 Occupations … 9 Contracts, as numbered in the register. */
    category: smallint('category').notNull(),
    declared: text('declared'),
    sourceUrl: text('source_url').notNull(),
  },
  (t) => [primaryKey({ columns: [t.memberCode, t.registerYear, t.category] }), index('td_interests_td_idx').on(t.tdId)],
);

// ---------------------------------------------------------------------------
// Parliamentary Standard Allowance payments (monthly PDF): one row per payment as printed.
// ---------------------------------------------------------------------------
export const tdAllowancePayments = politics.table(
  'td_allowance_payments',
  {
    sourceUrl: text('source_url').notNull(),
    /** Row number in the file, from 0. */
    position: integer('position').notNull(),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    /** The month the file covers (first day). */
    month: date('month').notNull(),
    /** As printed: "Deputy", "Minister", "Taoiseach", "Ceann Comhairle". NULL when the row has none. */
    title: text('title'),
    /** Travel and Accommodation Allowance band, e.g. "Dublin", "5", "MIN". */
    taaBand: text('taa_band'),
    narrative: text('narrative').notNull(),
    datePaid: date('date_paid').notNull(),
    amountCents: integer('amount_cents').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sourceUrl, t.position] }), index('td_allowance_payments_td_idx').on(t.tdId, t.month)],
);

// ---------------------------------------------------------------------------
// Committees: membership (from the roster) and sittings with their roll call
// (from committee transcripts). Joined on the committee's Oireachtas URI.
// ---------------------------------------------------------------------------
export const committees = politics.table('committees', {
  /** Last segment of the committee URI, e.g. "committee_of_public_accounts". */
  id: varchar('id', { length: 160 }).primaryKey(),
  uri: text('uri').notNull().unique(),
  name: text('name').notNull(),
  /** "Statutory", "Standing", "Select", "Joint", … as the Oireachtas types it. */
  committeeType: text('committee_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const committeeMemberships = politics.table(
  'committee_memberships',
  {
    committeeId: varchar('committee_id', { length: 160 })
      .notNull()
      .references(() => committees.id, { onDelete: 'cascade' }),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    /** "Cathaoirleach", "Leas-Chathaoirleach", or NULL for an ordinary member. */
    role: text('role'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
  },
  (t) => [
    primaryKey({ columns: [t.committeeId, t.memberCode, t.startDate] }),
    index('committee_memberships_td_idx').on(t.tdId),
  ],
);

export const committeeSittings = politics.table(
  'committee_sittings',
  {
    /** The transcript's debate-record URI; one per sitting. */
    uri: text('uri').primaryKey(),
    committeeId: varchar('committee_id', { length: 160 })
      .notNull()
      .references(() => committees.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    /** Members on the roll call. 0 means the transcript had none, not that nobody came. */
    presentCount: integer('present_count').notNull(),
    /**
     * Roll-call names that could be a TD but matched no member. Such a sitting cannot say
     * who was absent, so it is left out of committee attendance.
     */
    unresolvedCount: integer('unresolved_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('committee_sittings_committee_date_idx').on(t.committeeId, t.date)],
);

export const committeeAttendance = politics.table(
  'committee_attendance',
  {
    sittingUri: text('sitting_uri')
      .notNull()
      .references(() => committeeSittings.uri, { onDelete: 'cascade' }),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
  },
  (t) => [primaryKey({ columns: [t.sittingUri, t.memberCode] }), index('committee_attendance_td_idx').on(t.tdId)],
);

// ---------------------------------------------------------------------------
// Bills (/legislation): the bill, who sponsored it, its stages, and the debates it was
// taken in. `bill_debates.debate_section_id` uses the same id as
// `divisions.debate_section_id`, which is how a bill joins to how everyone voted on it.
// ---------------------------------------------------------------------------
export const bills = politics.table(
  'bills',
  {
    /** `<year>-<no>`, e.g. "2026-90". */
    id: varchar('id', { length: 20 }).primaryKey(),
    uri: text('uri').notNull().unique(),
    billNo: integer('bill_no').notNull(),
    billYear: smallint('bill_year').notNull(),
    shortTitle: text('short_title').notNull(),
    longTitle: text('long_title'),
    /** "Government" | "Private Member". */
    source: varchar('source', { length: 40 }).notNull(),
    /** "Current" | "Enacted" | "Lapsed" | "Defeated" | "Withdrawn" … as reported. */
    status: varchar('status', { length: 40 }).notNull(),
    originHouse: varchar('origin_house', { length: 40 }),
    mostRecentStage: text('most_recent_stage'),
    /** "27/2026" once enacted. */
    act: varchar('act', { length: 20 }),
    latestVersionPdf: text('latest_version_pdf'),
    memoPdf: text('memo_pdf'),
    lastUpdated: date('last_updated'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('bills_status_idx').on(t.status), index('bills_last_updated_idx').on(t.lastUpdated)],
);

export const billSponsors = politics.table(
  'bill_sponsors',
  {
    billId: varchar('bill_id', { length: 20 })
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    /** NULL for a sponsor who is an office (a Minister), not a named member. */
    memberCode: varchar('member_code', { length: 120 }),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    /** The member's name, or the office (e.g. "Minister for Finance"). */
    label: text('label').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.billId, t.position] }), index('bill_sponsors_td_idx').on(t.tdId), index('bill_sponsors_member_idx').on(t.memberCode)],
);

export const billStages = politics.table(
  'bill_stages',
  {
    billId: varchar('bill_id', { length: 20 })
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    stage: text('stage').notNull(),
    /** Free text from the API; a committee stage names the committee (up to ~100 chars). */
    chamber: text('chamber'),
    date: date('date'),
  },
  (t) => [primaryKey({ columns: [t.billId, t.position] })],
);

export const billDebates = politics.table(
  'bill_debates',
  {
    billId: varchar('bill_id', { length: 20 })
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    /**
     * `dail-<date>-<eId>`, `seanad-<date>-<eId>` or `committee-<code>-<date>-<eId>` (up to
     * ~130 chars). Only the Dáil form matches `divisions`.
     */
    debateSectionId: text('debate_section_id').notNull(),
    date: date('date').notNull(),
    chamber: text('chamber'),
    title: text('title'),
  },
  (t) => [primaryKey({ columns: [t.billId, t.debateSectionId] }), index('bill_debates_section_idx').on(t.debateSectionId)],
);

// ---------------------------------------------------------------------------
// Parliamentary questions, counted per TD, month, department and type. The text is not
// stored: a TD's focus areas need only the counts, and the text of ~150k questions a term
// would be most of the database.
// ---------------------------------------------------------------------------
export const questionType = politics.enum('question_type', ['oral', 'written']);
export type QuestionType = (typeof questionType.enumValues)[number];

export const questionCounts = politics.table(
  'question_counts',
  {
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    /** First day of the month. */
    month: date('month').notNull(),
    /** Who the question was put to, as the Oireachtas labels it, e.g. "Health". */
    department: varchar('department', { length: 120 }).notNull(),
    questionType: questionType('question_type').notNull(),
    n: integer('n').notNull(),
  },
  (t) => [primaryKey({ columns: [t.memberCode, t.month, t.department, t.questionType] }), index('question_counts_td_idx').on(t.tdId)],
);

// ---------------------------------------------------------------------------
// How far each feed has been ingested; the next sync starts from here.
// ---------------------------------------------------------------------------
export const parliamentSyncState = politics.table('parliament_sync_state', {
  /** 'roster' | 'divisions' | 'debates' | 'committees' | 'bills' | 'questions' */
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
export type NewBill = typeof bills.$inferInsert;
export type NewBillSponsor = typeof billSponsors.$inferInsert;
export type NewBillStage = typeof billStages.$inferInsert;
export type NewBillDebate = typeof billDebates.$inferInsert;

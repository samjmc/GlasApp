/**
 * Parliament tables: Dáil divisions, how each member voted, debate sections and speeches,
 * and the per-TD counts derived from them. Filled only by server/parliament/sync.ts from
 * api.oireachtas.ie; read by /api/parliament and the scoring pillars.
 *
 * Member codes (e.g. "Seán-Canney.D.2016-10-03") are the Oireachtas's own stable ids and
 * are kept on every row, so votes and speeches by someone not (yet) in `tds` are stored
 * and linked by `td_id` on the next roster sync instead of being dropped.
 */
import { boolean, date, index, integer, jsonb, primaryKey, real, serial, smallint, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
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
    /**
     * How many of that section's own speeches came before this division, from the transcript's
     * division marker (set by the debates feed). NULL = not located (no marker, or two
     * divisions in the section with the same counts); never 0 for "unknown".
     */
    sectionPosition: integer('section_position'),
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
    /**
     * The parent's heading. The parent is usually a container with no speeches of its own
     * ("Priority Questions"), so it is not stored and this is the only record of its kind.
     * NULL for a top-level section, and for rows ingested before this column existed.
     */
    parentTitle: text('parent_title'),
    /** debates.id, set by the grouping step of every sync; not a foreign key. */
    debateId: varchar('debate_id', { length: 80 }),
    speechCount: integer('speech_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('debate_sections_date_idx').on(t.date), index('debate_sections_debate_idx').on(t.debateId)],
);

// ---------------------------------------------------------------------------
// Debates: the sections that make up one debate, which can run over several days
// ("… (Resumed)") or be a container of question exchanges. Rebuilt from debate_sections by
// every sync (server/parliament/debateGroups.ts); nothing else writes it.
// ---------------------------------------------------------------------------
export const debateKind = politics.enum('debate_kind', [
  'bill_stage',
  'motion',
  'statements',
  'leaders_questions',
  'questions',
  'topical_issue',
  /** Formal business with no argument: First Stage, referrals, messages, Order of Business. */
  'procedural',
  /** A heading not in the list yet. The sync logs the most common ones. */
  'other',
]);
export type DebateKind = (typeof debateKind.enumValues)[number];

export const debateMoverSource = politics.enum('debate_mover_source', ['bill_sponsor', 'office_holder', 'first_speaker']);
export type DebateMoverSource = (typeof debateMoverSource.enumValues)[number];

export const debates = politics.table(
  'debates',
  {
    /** The id of its first unit: a section, or the container its question exchanges sit in. */
    id: varchar('id', { length: 80 }).primaryKey(),
    kind: debateKind('kind').notNull(),
    /** The heading without "(Resumed)" / "(Atógáil)". */
    title: text('title').notNull(),
    /** bills.id when bill_debates links one of its sections; the lowest id for a joint debate. */
    billId: varchar('bill_id', { length: 20 }),
    firstDate: date('first_date').notNull(),
    lastDate: date('last_date').notNull(),
    sectionCount: integer('section_count').notNull(),
    /** Who moved it, and how that was found. NULL when the record does not say. */
    moverMemberCode: varchar('mover_member_code', { length: 120 }),
    moverSource: debateMoverSource('mover_source'),
  },
  (t) => [index('debates_kind_date_idx').on(t.kind, t.firstDate)],
);

// ---------------------------------------------------------------------------
// Debate items (docs/plans/debate-analysis.md, Step 2): what a speech contains, as a model
// listed it and code then checked. Every item quotes its speech word for word; nothing here
// is a judgement of quality, truth or who won. Scored only after the check set (Step 3).
// ---------------------------------------------------------------------------
export const debateItemKind = politics.enum('debate_item_kind', ['specific_claim', 'response', 'concession', 'question', 'commitment']);
export type DebateItemKind = (typeof debateItemKind.enumValues)[number];

/** What makes a specific claim specific: a figure, a named source, a cost or a date. */
export const debateClaimType = politics.enum('debate_claim_type', ['figure', 'named_source', 'cost', 'date']);
export type DebateClaimType = (typeof debateClaimType.enumValues)[number];

/**
 * A commitment: a specific, checkable thing will be done (`action`); someone will reply, revert or
 * meet (`follow_up`); or a general undertaking with nothing specific to check (`general`: "I will
 * work as hard as possible", "we will continue to progress it"). Only `action` scores.
 */
export const commitmentType = politics.enum('commitment_type', ['action', 'follow_up', 'general']);
export type CommitmentType = (typeof commitmentType.enumValues)[number];

export const debateItems = politics.table(
  'debate_items',
  {
    id: serial('id').primaryKey(),
    /**
     * debate_speeches.id; deliberately not a foreign key. Re-reading a sitting day deletes and
     * re-inserts its speeches under the same ids, and a cascade would silently drop items whose
     * run still says `done`. A changed speech changes its run's input hash and is read again; an
     * item whose speech is gone for good is removed by the extractor (deleteOrphanItems).
     */
    speechId: varchar('speech_id', { length: 120 }).notNull(),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    kind: debateItemKind('kind').notNull(),
    /** Set for a specific claim only. */
    claimType: debateClaimType('claim_type'),
    /** The words as they appear in the speech, not as the model typed them. */
    quote: text('quote').notNull(),
    quoteStart: integer('quote_start').notNull(),
    quoteEnd: integer('quote_end').notNull(),
    /** A response or concession: the earlier speech it takes up (not a foreign key, as above). */
    targetSpeechId: varchar('target_speech_id', { length: 120 }),
    /** A response: the earlier words it takes up, as they appear in that speech. */
    targetQuote: text('target_quote'),
    /** A question: who it was put to, as said ("the Minister", "Deputy Daly"). */
    addressee: text('addressee'),
    /** A commitment: the time it gives, as said. */
    due: text('due'),
    /** A commitment read from a question session (extractor q1); NULL for every debate item. */
    commitmentType: commitmentType('commitment_type'),
    extractorVersion: varchar('extractor_version', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('debate_items_speech_idx').on(t.speechId), index('debate_items_member_idx').on(t.memberCode, t.kind)],
);

/** Whether a TD held government office (cabinet or Minister of State) on the debate's first day. */
export const debateRole = politics.enum('debate_role', ['office', 'backbench']);

/**
 * Each member's record in each argued debate that has been read: what they said, and the points
 * the published rules give it (server/parliament/debateItems/rules.ts). Derived: rebuilt in full,
 * with no model calls, after every extraction run and every sync. Not part of the TD score.
 */
export const debateParticipation = politics.table(
  'debate_participation',
  {
    debateId: varchar('debate_id', { length: 80 }).notNull(),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    role: debateRole('role').notNull(),
    speeches: integer('speeches').notNull(),
    words: integer('words').notNull(),
    claims: integer('claims').notNull(),
    claimPoints: integer('claim_points').notNull(),
    /** Concessions made TO this member; only those across the House score. */
    concessionsReceived: integer('concessions_received').notNull(),
    concessionPoints: integer('concession_points').notNull(),
    /** Replies this member made that name their target (rules r2). */
    replies: integer('replies').notNull().default(0),
    /** Distinct speakers whose reply to this member scores: another party, not the closing speech. */
    takenUp: integer('taken_up').notNull().default(0),
    takenUpPoints: integer('taken_up_points').notNull().default(0),
    questions: integer('questions').notNull(),
    commitments: integer('commitments').notNull(),
    points: integer('points').notNull(),
    rulesVersion: varchar('rules_version', { length: 20 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.debateId, t.memberCode] }), index('debate_participation_member_idx').on(t.memberCode), index('debate_participation_td_idx').on(t.tdId)],
);

export const debateExtractionStatus = politics.enum('debate_extraction_status', ['done', 'failed']);

/** One extraction of one debate by one extractor version: what it cost and what was rejected. */
export const debateExtractionRuns = politics.table(
  'debate_extraction_runs',
  {
    debateId: varchar('debate_id', { length: 80 }).notNull(),
    extractorVersion: varchar('extractor_version', { length: 20 }).notNull(),
    /** The speeches read (ids and text). A different hash means the record changed. */
    inputHash: varchar('input_hash', { length: 16 }).notNull(),
    status: debateExtractionStatus('status').notNull(),
    speeches: integer('speeches').notNull(),
    words: integer('words').notNull(),
    /** Speeches mostly in Irish, to compare rejection rates by language. */
    irishSpeeches: integer('irish_speeches').notNull(),
    calls: integer('calls').notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    accepted: integer('accepted').notNull(),
    /** reason → { en, ga } counts of items code rejected. */
    rejected: jsonb('rejected').$type<Record<string, { en: number; ga: number }>>().notNull().default({}),
    model: varchar('model', { length: 60 }),
    error: text('error'),
    ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.debateId, t.extractorVersion] })],
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

/** `code`: the list in absences.ts, replaced by every sync. `admin`: confirmed from the leave watch, kept. */
export const absenceOrigin = politics.enum('absence_origin', ['code', 'admin']);
export type AbsenceOrigin = (typeof absenceOrigin.enumValues)[number];

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
    origin: absenceOrigin('origin').notNull().default('code'),
  },
  (t) => [primaryKey({ columns: [t.memberCode, t.startDate] }), index('td_absences_td_idx').on(t.tdId)],
);

// ---------------------------------------------------------------------------
// Leave watch: a weekly job lists runs of sitting days on which an active TD neither voted nor
// spoke and no documented absence covers. It records the run and, as a pointer for the
// reviewer, news articles that may explain it. It decides nothing: a person confirms a leave
// with a public source (it becomes a td_absences row) or dismisses the run. A dismissed run that
// doubles in length is opened again.
// ---------------------------------------------------------------------------
export const leaveAlertStatus = politics.enum('leave_alert_status', ['open', 'confirmed', 'dismissed', 'closed']);
export type LeaveAlertStatus = (typeof leaveAlertStatus.enumValues)[number];

export interface LeaveHint {
  title: string;
  url: string;
  publishedAt: string;
}

export const tdLeaveAlerts = politics.table(
  'td_leave_alerts',
  {
    id: serial('id').primaryKey(),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    /** First and latest silent sitting day of the run. The first never moves; the latest does. */
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    sittingDays: integer('sitting_days').notNull(),
    status: leaveAlertStatus('status').notNull().default('open'),
    /** News that may explain the run. A pointer for the reviewer, never a reason. */
    hints: jsonb('hints').$type<LeaveHint[]>().notNull().default([]),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** An admin's email, or 'watch' when the job closed it itself. */
    resolvedBy: text('resolved_by'),
    resolutionNote: text('resolution_note'),
    /** Length of the run when it was dismissed: the run opens again at twice this. */
    daysWhenResolved: integer('days_when_resolved'),
  },
  (t) => [uniqueIndex('td_leave_alerts_run_idx').on(t.memberCode, t.startDate), index('td_leave_alerts_status_idx').on(t.status)],
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
// Question sessions (docs/plans/question-sessions.md): who asked each oral PQ, the exchanges a
// session splits into, and the record built from what ministers committed to in them.
// ---------------------------------------------------------------------------

/** Who asked each oral PQ, and the Official Report section it was answered in. From /questions. */
export const questionAskers = politics.table(
  'question_askers',
  {
    /** debate_sections.id: "dail-<date>-<debateSectionId>". Not a foreign key: days are re-read. */
    sectionId: varchar('section_id', { length: 80 }).notNull(),
    questionNumber: integer('question_number').notNull(),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    date: date('date').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sectionId, t.questionNumber] }), index('question_askers_member_idx').on(t.memberCode), index('question_askers_date_idx').on(t.date)],
);

/**
 * How an exchange was asked: an oral PQ (askers from /questions), a Topical Issue, Leaders'
 * Questions, or a rapid session (Questions on Policy or Legislation, Promised Legislation).
 */
export const questionFormat = politics.enum('question_format', ['oral_pq', 'topical_issue', 'leaders_questions', 'rapid']);
export type QuestionFormat = (typeof questionFormat.enumValues)[number];

/**
 * One asker's question and the answers to it: a span of one section's speeches. Derived from the
 * speeches, the PQ askers and the offices, and rebuilt in full by every sync.
 */
export const questionExchanges = politics.table(
  'question_exchanges',
  {
    /** "<section id>#<n>", n from 1 in record order. */
    id: varchar('id', { length: 100 }).primaryKey(),
    sectionId: varchar('section_id', { length: 80 }).notNull(),
    format: questionFormat('format').notNull(),
    date: date('date').notNull(),
    /** Member codes of whoever asked; several for questions taken together. */
    askers: jsonb('askers').$type<string[]>().notNull(),
    /** debate_speeches.position of the first and last speech in the exchange. */
    fromPosition: integer('from_position').notNull(),
    toPosition: integer('to_position').notNull(),
  },
  (t) => [index('question_exchanges_section_idx').on(t.sectionId)],
);

/**
 * Each member's part in each question exchange that has been read, and the points the
 * published rules give it (server/parliament/questionItems/rules.ts). Derived like
 * debate_participation; not part of the TD score.
 */
export const questionParticipation = politics.table(
  'question_participation',
  {
    exchangeId: varchar('exchange_id', { length: 100 }).notNull(),
    memberCode: varchar('member_code', { length: 120 }).notNull(),
    tdId: integer('td_id').references(() => tds.id, { onDelete: 'set null' }),
    format: questionFormat('format').notNull(),
    role: debateRole('role').notNull(),
    asked: boolean('asked').notNull(),
    /** An asker: `action` commitments a minister made in the exchange (scored once, across the House). */
    secured: integer('secured').notNull(),
    /** An asker: promises to reply or revert (shown, no points). */
    followUps: integer('follow_ups').notNull(),
    /** An office holder who answered in the exchange. */
    answered: boolean('answered').notNull(),
    /** An answerer: specific claims and `action` commitments in their answers (shown, never ranked). */
    answerClaims: integer('answer_claims').notNull(),
    answerCommitments: integer('answer_commitments').notNull(),
    points: integer('points').notNull(),
    rulesVersion: varchar('rules_version', { length: 20 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.exchangeId, t.memberCode] }), index('question_participation_member_idx').on(t.memberCode), index('question_participation_td_idx').on(t.tdId)],
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
export type NewDebate = typeof debates.$inferInsert;
export type NewDebateItem = typeof debateItems.$inferInsert;
export type NewDebateExtractionRun = typeof debateExtractionRuns.$inferInsert;
export type NewDebateParticipation = typeof debateParticipation.$inferInsert;
export type NewDebateSpeech = typeof debateSpeeches.$inferInsert;
export type TdParliamentStatsRow = typeof tdParliamentStats.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type NewBillSponsor = typeof billSponsors.$inferInsert;
export type NewBillStage = typeof billStages.$inferInsert;
export type NewBillDebate = typeof billDebates.$inferInsert;

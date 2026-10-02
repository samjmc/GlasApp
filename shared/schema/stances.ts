/**
 * TD stances (docs/plans/td-stances.md): one row per TD per canonical news article in which the
 * TD stated a position, with the quote checked against the article text by server/stances.
 * No model-written summary is stored: the quote and the link are the record.
 *
 * A row can instead be a recorded Dáil vote (docs/plans/quiz-improvements/01c): `division_id`
 * set, `quote_kind` 'division', the quote being the text of the proposal voted on. Those rows
 * are derived from `division_readings` and the roll call, and replaced whole by each sync.
 *
 * The article's url, outlet and headline are copies, and so is `option_text`: the question bank
 * can change, and the record should still say what the TD was matched to.
 */
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, real, serial, smallint, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
// Pure data with no imports, so the schema can read the one list of domains.
import { POLICY_DOMAINS } from '../../server/constants/policyTopics';
import { DIVISION_KINDS, DIVISION_READING_STATUSES, DIVISION_REJECT_REASONS } from '../divisionMeaning';
import { DISCIPLINES, QUOTE_KINDS, STANCE_VOTES } from '../stancesApi';
import { newsArticles } from './news';
import { divisions } from './parliament';
import { politics, tds } from './politics';
import { policyQuestionOptions } from './voting';

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));
const DOMAIN_KEYS = Object.keys(POLICY_DOMAINS);

export const tdStances = politics.table(
  'td_stances',
  {
    id: serial('id').primaryKey(),
    tdId: integer('td_id')
      .notNull()
      .references(() => tds.id, { onDelete: 'cascade' }),
    /** The event's canonical article: a duplicate is never processed. NULL on a Dáil vote. */
    articleId: integer('article_id').references(() => newsArticles.id, { onDelete: 'cascade' }),
    /** The Dáil division, on a recorded vote; NULL on a news quote. */
    divisionId: varchar('division_id', { length: 80 }).references(() => divisions.id, { onDelete: 'cascade' }),
    /** 'ta' or 'nil', on a Dáil vote. */
    divisionVote: varchar('division_vote', { length: 3 }),
    /** free, rebel or whip, on a Dáil vote: only free and rebel votes are axis evidence. */
    discipline: varchar('discipline', { length: 8 }),
    /**
     * The article's daily-vote question and the answer the quote states. Set together, or both
     * NULL: no question, or the quote states no clear answer.
     */
    questionId: integer('question_id'),
    optionKey: varchar('option_key', { length: 12 }),
    quote: text('quote').notNull(),
    quoteKind: varchar('quote_kind', { length: 12 }).notNull(),
    policyDomain: varchar('policy_domain', { length: 40 }).notNull(),
    /** The option's label when it was matched. */
    optionText: text('option_text'),
    /** The article's published_at (created_at when it has none); a vote's time. */
    statedAt: timestamp('stated_at', { withTimezone: true }).notNull(),
    articleUrl: text('article_url').notNull(),
    sourceName: varchar('source_name', { length: 100 }).notNull(),
    headline: text('headline').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('td_stances_td_article_idx').on(t.tdId, t.articleId),
    // NULLs are distinct, so news rows (division_id NULL) never collide here.
    uniqueIndex('td_stances_td_division_idx').on(t.tdId, t.divisionId),
    index('td_stances_td_stated_idx').on(t.tdId, t.statedAt),
    index('td_stances_question_idx').on(t.questionId),
    // An answer that is not one of the question's options cannot be stored. Deleting the option
    // (or its question) clears both columns rather than the stance. One composite key, not a
    // second key on question_id alone: that one fired first and left an orphan option_key.
    check('td_stances_answer_chk', sql`(${t.questionId} is null) = (${t.optionKey} is null)`),
    foreignKey({
      name: 'td_stances_option_fk',
      columns: [t.questionId, t.optionKey],
      foreignColumns: [policyQuestionOptions.questionId, policyQuestionOptions.optionKey],
    }).onDelete('set null'),
    check('td_stances_quote_kind_chk', sql`${t.quoteKind} in (${inList(QUOTE_KINDS)})`),
    check('td_stances_policy_domain_chk', sql`${t.policyDomain} in (${inList(DOMAIN_KEYS)})`),
    // Exactly one of: a news article, or a Dáil division.
    check('td_stances_source_chk', sql`(${t.articleId} is null) <> (${t.divisionId} is null)`),
    check('td_stances_division_kind_chk', sql`(${t.quoteKind} = 'division') = (${t.divisionId} is not null)`),
    check(
      'td_stances_division_vote_chk',
      sql`${t.divisionVote} in (${inList(STANCE_VOTES)}) and (${t.divisionVote} is null) = (${t.divisionId} is null)`,
    ),
    check(
      'td_stances_discipline_chk',
      sql`${t.discipline} in (${inList(DISCIPLINES)}) and (${t.discipline} is null) = (${t.divisionId} is null)`,
    ),
  ],
);

/**
 * What one Dáil division meant, as a model read it, and the daily-vote option it matched: one
 * row per division. The model's output is per division, so it is read once and cached here;
 * the per-TD rows in `td_stances` are derived from it and the roll call with no model call.
 * Every reading column is NULL until the step that fills it has run.
 */
export const divisionReadings = politics.table(
  'division_readings',
  {
    divisionId: varchar('division_id', { length: 80 })
      .primaryKey()
      .references(() => divisions.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 }).notNull(),
    rejectReason: varchar('reject_reason', { length: 20 }),
    divisionKind: varchar('division_kind', { length: 16 }),
    /** One sentence: what a Tá vote supported. Never shown to users. */
    taMeans: text('ta_means'),
    /** The PROPOSAL block the quote came from (Q, B1, M1, A1 …). */
    quoteBlock: varchar('quote_block', { length: 8 }),
    /** The verified passage, as it appears in that block. Set only when the quote was found. */
    quote: text('quote'),
    policyDomain: varchar('policy_domain', { length: 40 }),
    secondDomain: varchar('second_domain', { length: 40 }),
    meaningConfidence: real('meaning_confidence'),
    matchConfidence: real('match_confidence'),
    /** The question ids the match call was given (the re-check compares sets). */
    candidateIds: integer('candidate_ids').array(),
    questionId: integer('question_id'),
    taOptionKey: varchar('ta_option_key', { length: 12 }),
    nilOptionKey: varchar('nil_option_key', { length: 12 }),
    matchReason: text('match_reason'),
    /** The model that answered (the provider can replace the one asked for). */
    model: varchar('model', { length: 60 }),
    meaningPromptVersion: smallint('meaning_prompt_version'),
    matchPromptVersion: smallint('match_prompt_version'),
    /** Hash of the division's subject, debate, section, position and tallies when it was read. */
    inputHash: varchar('input_hash', { length: 16 }).notNull(),
    /** Model calls in a row that failed; a failed reading is retried below a cap. */
    attempts: smallint('attempts').notNull().default(0),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
    matchCheckedAt: timestamp('match_checked_at', { withTimezone: true }),
  },
  (t) => [
    check('division_readings_status_chk', sql`${t.status} in (${inList(DIVISION_READING_STATUSES)})`),
    check(
      'division_readings_reject_reason_chk',
      sql`${t.rejectReason} in (${inList(DIVISION_REJECT_REASONS)}) and (${t.status} = 'rejected') = (${t.rejectReason} is not null)`,
    ),
    check('division_readings_kind_chk', sql`${t.divisionKind} in (${inList(DIVISION_KINDS)})`),
    check('division_readings_domain_chk', sql`${t.policyDomain} in (${inList(DOMAIN_KEYS)})`),
    check('division_readings_second_domain_chk', sql`${t.secondDomain} in (${inList(DOMAIN_KEYS)})`),
    check('division_readings_confidence_chk', sql`${t.meaningConfidence} between 0 and 1 and ${t.matchConfidence} between 0 and 1`),
    check('division_readings_matched_chk', sql`(${t.status} = 'matched') = (${t.questionId} is not null)`),
    check('division_readings_answer_chk', sql`(${t.questionId} is null) = (${t.taOptionKey} is null)`),
    check('division_readings_nil_chk', sql`${t.nilOptionKey} is null or ${t.nilOptionKey} <> ${t.taOptionKey}`),
    check('division_readings_quoted_chk', sql`${t.status} <> 'matched' or (${t.quote} is not null and ${t.taMeans} is not null)`),
    // A deleted question takes the reading with it, and the division is read again.
    foreignKey({
      name: 'division_readings_ta_option_fk',
      columns: [t.questionId, t.taOptionKey],
      foreignColumns: [policyQuestionOptions.questionId, policyQuestionOptions.optionKey],
    }).onDelete('cascade'),
    foreignKey({
      name: 'division_readings_nil_option_fk',
      columns: [t.questionId, t.nilOptionKey],
      foreignColumns: [policyQuestionOptions.questionId, policyQuestionOptions.optionKey],
    }).onDelete('cascade'),
  ],
);

export type TdStanceRow = typeof tdStances.$inferSelect;
export type NewTdStance = typeof tdStances.$inferInsert;
export type DivisionReadingRow = typeof divisionReadings.$inferSelect;
export type NewDivisionReading = typeof divisionReadings.$inferInsert;

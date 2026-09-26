/**
 * TD stances (docs/plans/td-stances.md): one row per TD per canonical news article in which the
 * TD stated a position, with the quote checked against the article text by server/stances.
 * No model-written summary is stored: the quote and the link are the record.
 *
 * The article's url, outlet and headline are copies, and so is `option_text`: the question bank
 * can change, and the record should still say what the TD was matched to.
 */
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
// Pure data with no imports, so the schema can read the one list of domains.
import { POLICY_DOMAINS } from '../../server/constants/policyTopics';
import { QUOTE_KINDS } from '../stancesApi';
import { newsArticles } from './news';
import { politics, tds } from './politics';
import { policyQuestionOptions } from './voting';

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

export const tdStances = politics.table(
  'td_stances',
  {
    id: serial('id').primaryKey(),
    tdId: integer('td_id')
      .notNull()
      .references(() => tds.id, { onDelete: 'cascade' }),
    /** The event's canonical article: a duplicate is never processed. */
    articleId: integer('article_id')
      .notNull()
      .references(() => newsArticles.id, { onDelete: 'cascade' }),
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
    /** The article's published_at (created_at when it has none). */
    statedAt: timestamp('stated_at', { withTimezone: true }).notNull(),
    articleUrl: text('article_url').notNull(),
    sourceName: varchar('source_name', { length: 100 }).notNull(),
    headline: text('headline').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('td_stances_td_article_idx').on(t.tdId, t.articleId),
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
    check('td_stances_policy_domain_chk', sql`${t.policyDomain} in (${inList(Object.keys(POLICY_DOMAINS))})`),
  ],
);

export type TdStanceRow = typeof tdStances.$inferSelect;
export type NewTdStance = typeof tdStances.$inferInsert;

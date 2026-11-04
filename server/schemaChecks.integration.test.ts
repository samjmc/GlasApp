/**
 * Migration 0032's CHECKs against a real Postgres: each refuses the row it is for and names
 * itself, and the migration fails on a database that already holds a bad row (so it never half
 * applies on GlasCore: drizzle runs it in one transaction). Skipped unless TEST_DATABASE_URL is
 * set; uses its own database, `<db>_schemachecks`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/schemaChecks.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pkg from 'pg';
import { applyAllMigrations, applyMigration, ensureDatabase, testDatabaseUrl } from './testing/migrations';

const url = testDatabaseUrl('schemachecks');
const run = describe.skipIf(!url);
const MIGRATION = '0032_checks_drop_member_uri';

/** Each check, a row it refuses, and a row it allows (the same insert with the rule kept). */
const CASES: Array<{ check: string; bad: string; good: string }> = [
  { check: 'users_political_consent_chk', bad: "insert into politics.users (id, political_consent_at) values ('u-bad', now())", good: "insert into politics.users (id, political_consent_at, political_consent_version) values ('u-good', now(), 1)" },
  { check: 'news_articles_status_chk', bad: "insert into politics.news_articles (source_id, url, title, published_at, status) values (1, 'u1', 't', now(), 'done')", good: "insert into politics.news_articles (source_id, url, title, published_at, status) values (1, 'u2', 't', now(), 'scored')" },
  { check: 'news_articles_category_chk', bad: "insert into politics.news_articles (source_id, url, title, published_at, category) values (1, 'u3', 't', now(), 'sport')", good: "insert into politics.news_articles (source_id, url, title, published_at, category) values (1, 'u4', 't', now(), 'other')" },
  { check: 'news_articles_score_range_chk', bad: "insert into politics.news_articles (source_id, url, title, published_at, relevance_score) values (1, 'u5', 't', now(), 101)", good: "insert into politics.news_articles (source_id, url, title, published_at, relevance_score, importance_score) values (1, 'u6', 't', now(), 100, 0)" },
  { check: 'debate_items_claim_type_chk', bad: "insert into politics.debate_items (speech_id, member_code, kind, quote, quote_start, quote_end, extractor_version) values ('s', 'm', 'specific_claim', 'q', 0, 1, 'v')", good: "insert into politics.debate_items (speech_id, member_code, kind, claim_type, quote, quote_start, quote_end, extractor_version) values ('s', 'm', 'specific_claim', 'figure', 'q', 0, 1, 'v')" },
  { check: 'debate_items_commitment_type_chk', bad: "insert into politics.debate_items (speech_id, member_code, kind, commitment_type, quote, quote_start, quote_end, extractor_version) values ('s', 'm', 'question', 'action', 'q', 0, 1, 'v')", good: "insert into politics.debate_items (speech_id, member_code, kind, commitment_type, quote, quote_start, quote_end, extractor_version) values ('s', 'm', 'commitment', 'action', 'q', 0, 1, 'v')" },
  { check: 'debate_items_quote_range_chk', bad: "insert into politics.debate_items (speech_id, member_code, kind, quote, quote_start, quote_end, extractor_version) values ('s', 'm', 'question', 'q', 5, 4, 'v')", good: "insert into politics.debate_items (speech_id, member_code, kind, quote, quote_start, quote_end, extractor_version) values ('s', 'm', 'question', 'q', 4, 4, 'v')" },
  { check: 'debates_dates_chk', bad: "insert into politics.debates (id, kind, title, first_date, last_date, section_count) values ('d1', 'motion', 't', '2026-01-02', '2026-01-01', 1)", good: "insert into politics.debates (id, kind, title, first_date, last_date, section_count) values ('d2', 'motion', 't', '2026-01-01', '2026-01-01', 1)" },
  { check: 'td_absences_dates_chk', bad: "insert into politics.td_absences (member_code, start_date, end_date, reason, source_url) values ('m', '2026-01-02', '2026-01-01', 'other_leave', 's')", good: "insert into politics.td_absences (member_code, start_date, end_date, reason, source_url) values ('m', '2026-01-01', '2026-01-01', 'other_leave', 's')" },
  { check: 'td_party_leaders_dates_chk', bad: "insert into politics.td_party_leaders (member_code, party, start_date, end_date, source_url) values ('m', 'p', '2026-01-02', '2026-01-01', 's')", good: "insert into politics.td_party_leaders (member_code, party, start_date, end_date, source_url) values ('m', 'p', '2026-01-01', null, 's')" },
  { check: 'td_scores_range_chk', bad: 'insert into politics.td_scores (td_id, debate_score) values (1, -1)', good: 'insert into politics.td_scores (td_id, overall_score, parliamentary_score, debate_score) values (2, 100, 0, null)' },
  { check: 'tds_pct_range_chk', bad: "insert into politics.tds (name, attendance_pct) values ('Over', 100.1)", good: "insert into politics.tds (name, attendance_pct, committee_attendance_pct) values ('Full', 100, 0)" },
  { check: 'policy_questions_domain_chk', bad: "insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline) values (1, 'q', 'sport', 't', 'h')", good: "insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline) values (2, 'q', 'other', 't', 'h')" },
  { check: 'policy_questions_dimension_chk', bad: "insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline, primary_dimension) values (3, 'q', 'housing', 't', 'h', 'left')", good: "insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline, primary_dimension) values (4, 'q', 'housing', 't', 'h', 'welfare')" },
];

run('migration 0032 checks (real Postgres)', () => {
  let pool: pkg.Pool;
  const q = (text: string) => pool.query(text);

  beforeAll(async () => {
    await ensureDatabase(url!);
    pool = new pkg.Pool({ connectionString: url });
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('fails on a database that already holds a row one check refuses', async () => {
    await applyAllMigrations(pool, MIGRATION);
    await q("insert into politics.td_absences (member_code, start_date, end_date, reason, source_url) values ('m', '2026-01-02', '2026-01-01', 'other_leave', 's')");
    await expect(applyMigration(pool, MIGRATION)).rejects.toThrow(/td_absences_dates_chk/);
  }, 60_000);

  it('every check refuses its bad row by name and allows the good one', async () => {
    await applyAllMigrations(pool);
    await q("insert into politics.news_sources (slug, name, homepage_url) values ('s', 'S', 'https://s.ie')");
    await q("insert into politics.tds (name) values ('One'), ('Two')");
    const { rows } = await q("select count(*)::int n from pg_constraint where conname like any (array['%_chk']) and connamespace = 'politics'::regnamespace and convalidated");
    expect(rows[0].n).toBeGreaterThanOrEqual(CASES.length);
    for (const c of CASES) {
      await expect(q(c.bad), c.check).rejects.toThrow(new RegExp(c.check));
      await expect(q(c.good), c.check).resolves.toBeDefined();
    }
    const { rows: cols } = await q("select 1 from information_schema.columns where table_schema = 'politics' and table_name = 'tds' and column_name = 'member_uri'");
    expect(cols).toHaveLength(0);
  }, 60_000);
});

/**
 * replaceDivisionStances' diff against the delete-all-and-insert it replaced: the same sequence of
 * Dáil-vote stance sets leaves exactly the same rows, never touches a news stance, rewrites nothing
 * when the set is unchanged, and keeps the id of every stance that stays. Skipped unless
 * TEST_DATABASE_URL is set; uses its own database, `<db>_divstances`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55471/postgres"
 *   npx vitest run server/stances/divisionStances.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NewTdStance } from '@shared/schema/stances';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('divstances');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.LOG_LEVEL = 'silent';
}

const COLUMNS = `td_id, article_id, division_id, division_vote, discipline, question_id, option_key, option_text, quote,
  quote_kind, policy_domain, stated_at, article_url, source_name, headline`;

run('replaceDivisionStances (real Postgres)', () => {
  let dbmod: typeof import('../db');
  let repo: typeof import('./repository');
  let tdIds: number[];
  let questionId: number;
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);

  /** One TD's stance on one division, as divisionStanceRows builds it. */
  const row = (td: number, division: number, vote: 'ta' | 'nil', discipline = 'whip', quote = 'the motion'): NewTdStance => ({
    tdId: tdIds[td],
    articleId: null,
    divisionId: `dail-34-2026-09-2${division}-vote_1`,
    divisionVote: vote,
    discipline,
    questionId,
    optionKey: vote === 'ta' ? 'a' : 'b',
    optionText: vote === 'ta' ? 'Yes' : 'No',
    quote,
    quoteKind: 'division',
    policyDomain: 'health',
    statedAt: new Date(`2026-09-2${division}T12:00:00Z`),
    articleUrl: `https://www.oireachtas.ie/vote/${division}`,
    sourceName: 'Dáil Éireann',
    headline: `Division ${division}`,
  });

  /** The delete-all-and-insert this replaced. */
  async function oldReplace(rows: NewTdStance[]): Promise<void> {
    const { tdStances } = await import('@shared/schema/stances');
    const { isNotNull } = await import('drizzle-orm');
    await dbmod.db.transaction(async (tx) => {
      await tx.delete(tdStances).where(isNotNull(tdStances.divisionId));
      if (rows.length) await tx.insert(tdStances).values(rows);
    });
  }

  const contents = async () => (await q(`select ${COLUMNS} from politics.td_stances order by td_id, division_id nulls first`)).rows;
  const idsAndXmins = async () => (await q('select td_id, division_id, id, xmin::text from politics.td_stances order by td_id, division_id nulls first')).rows;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('./repository');
    tdIds = [];
    for (let i = 0; i < 12; i++) tdIds.push((await q('insert into politics.tds (name) values ($1) returning id', [`TD ${i}`])).rows[0].id);
    for (const d of [1, 2, 3, 4]) {
      await q(`insert into politics.divisions (id, uri, house_no, date, ta_count, nil_count, staon_count) values ($1, $2, 34, $3, 1, 1, 0)`, [
        `dail-34-2026-09-2${d}-vote_1`,
        `u${d}`,
        `2026-09-2${d}`,
      ]);
    }
    questionId = (
      await q(`insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline) values (1, 'Q?', 'health', 'health_topic', 'h') returning id`)
    ).rows[0].id;
    for (const [i, key] of ['a', 'b'].entries()) {
      await q('insert into politics.policy_question_options (question_id, option_key, label, position) values ($1, $2, $3, $4)', [questionId, key, key === 'a' ? 'Yes' : 'No', i]);
    }
    // A news stance: neither version may touch it.
    await q(`insert into politics.news_sources (slug, name, homepage_url) values ('rte', 'RTÉ', 'https://rte.ie')`);
    await q(`insert into politics.news_articles (source_id, url, title, published_at) values (1, 'https://rte.ie/a', 'A', now())`);
    await q(
      `insert into politics.td_stances (td_id, article_id, quote, quote_kind, policy_domain, stated_at, article_url, source_name, headline)
       values ($1, 1, 'said so', 'direct', 'health', now(), 'https://rte.ie/a', 'RTÉ', 'A')`,
      [tdIds[0]],
    );
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('leaves the same rows as delete-and-insert, keeps the news stance, and keeps ids of rows that stay', async () => {
    const first = [1, 2, 3].flatMap((d) => tdIds.map((_, td) => row(td, d, (td + d) % 3 === 0 ? 'nil' : 'ta')));
    // The next sync: division 3 is no longer matched, division 4 is new, TD 5 changed side on
    // division 1, TD 6's discipline changed on division 2, TD 7 did not vote in division 2.
    const second = [
      ...first.filter((r) => !r.divisionId!.endsWith('23-vote_1') && !(r.tdId === tdIds[7] && r.divisionId!.endsWith('22-vote_1'))),
      ...tdIds.map((_, td) => row(td, 4, 'ta', 'free')),
    ].map((r) => {
      if (r.tdId === tdIds[5] && r.divisionId!.endsWith('21-vote_1')) return row(5, 1, r.divisionVote === 'ta' ? 'nil' : 'ta');
      if (r.tdId === tdIds[6] && r.divisionId!.endsWith('22-vote_1')) return { ...r, discipline: 'rebel' };
      return r;
    });
    const steps = [first, second, second];

    for (const s of steps) await oldReplace(s);
    const old = await contents();
    await q('delete from politics.td_stances where division_id is not null');

    await repo.replaceDivisionStances(first);
    const afterFirst = await idsAndXmins();
    await repo.replaceDivisionStances(second);
    const afterSecond = await idsAndXmins();
    await repo.replaceDivisionStances(second);

    expect(await contents()).toEqual(old);
    expect(old).toHaveLength(1 + second.length);
    // An unchanged set rewrites nothing.
    expect(await idsAndXmins()).toEqual(afterSecond);
    // Rows that stayed kept their ids; the changed ones were updated in place, not re-inserted.
    const idOf = (rows: typeof afterFirst, td: number, division: number) =>
      rows.find((r: { td_id: number; division_id: string | null }) => r.td_id === tdIds[td] && r.division_id === `dail-34-2026-09-2${division}-vote_1`)?.id;
    for (const [td, division] of [[0, 1], [5, 1], [6, 2], [11, 2]]) expect(idOf(afterSecond, td, division)).toBe(idOf(afterFirst, td, division));
    expect(idOf(afterSecond, 7, 2)).toBeUndefined();
  });
});

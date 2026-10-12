/**
 * The question record against a real Postgres: exchanges cut from stored sections and PQ askers,
 * points rebuilt from stored q1 items, the two reads, and the debate record left untouched.
 * Skipped unless TEST_DATABASE_URL is set; uses its own database, `<db>_questionrecord`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55433/postgres"
 *   npx vitest run server/parliament/repo/questionRecord.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../../testing/migrations';

const url = testDatabaseUrl('questionrecord');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const DAY = '2026-09-30';
const A = 'Ann-Opp.D.2020-02-08'; // Sinn Féin
const B = 'Ben-Opp.D.2020-02-08'; // Labour
const G = 'Gus-Gov.D.2020-02-08'; // Fianna Fáil backbencher
const M = 'Mel-Min.D.2016-10-03'; // Fianna Fáil, Minister for Health
const K = 'Kit-MoS.D.2020-02-08'; // Fianna Fáil, a Minister of State who only interjects
const S = 'Sue-Spk.D.2020-02-08'; // Social Democrats, who only interjects
const PQ = `dail-${DAY}-dbsect_3`; // oral PQs 4 and 5, taken together
const TI = `dail-${DAY}-dbsect_8`; // a Topical Issue
const LQ = `dail-${DAY}-dbsect_1`; // Leaders' Questions
const RQ = `dail-${DAY}-dbsect_10`; // Questions on Promised Legislation, ten exchanges

run('question record (real Postgres)', () => {
  let dbmod: typeof import('../../db');
  let repo: typeof import('../repository');
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);
  const tdIdOf = async (code: string) => (await q('select id from politics.tds where member_code = $1', [code])).rows[0].id as number;
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  const addSection = async (id: string, kind: string, title: string, speeches: Array<[number, string, string]>) => {
    await q('insert into politics.debates (id, kind, title, first_date, last_date, section_count) values ($1, $2, $3, $4, $4, 1)', [id, kind, title, DAY]);
    await q('insert into politics.debate_sections (id, date, title, speech_count, debate_id) values ($1, $2, $3, $4, $1)', [id, DAY, title, speeches.length]);
    for (const [position, member, text] of speeches) {
      await q('insert into politics.debate_speeches (id, section_id, date, position, member_code, text, word_count) values ($1, $2, $3, $4, $5, $6, $7)', [
        `${id}/spk_${position}`, id, DAY, position, member, text, text.split(' ').length,
      ]);
    }
  };
  const item = (speech: string, member: string, kind: string, quote: string, type: string | null) =>
    q(
      `insert into politics.debate_items (speech_id, member_code, kind, claim_type, quote, quote_start, quote_end, commitment_type, extractor_version)
       values ($1, $2, $3, $4, $5, 0, 1, $6, 'q1')`,
      [speech, member, kind, kind === 'specific_claim' ? 'figure' : null, quote, type],
    );
  const markRead = (exchangeId: string) =>
    q(
      `insert into politics.debate_extraction_runs (debate_id, extractor_version, input_hash, status, speeches, words, irish_speeches, calls, prompt_tokens, completion_tokens, accepted)
       values ($1, 'q1', 'h', 'done', 2, 20, 0, 1, 1, 1, 1)`,
      [exchangeId],
    );

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('../repository');
    for (const [code, name, party] of [[A, 'Ann Opp', 'Sinn Féin'], [B, 'Ben Opp', 'Labour Party'], [G, 'Gus Gov', 'Fianna Fáil'], [M, 'Mel Min', 'Fianna Fáil'], [K, 'Kit MoS', 'Fianna Fáil'], [S, 'Sue Spk', 'Social Democrats']]) {
      await q('insert into politics.tds (name, member_code, party) values ($1, $2, $3)', [name, code, party]);
    }
    await q("insert into politics.td_offices (member_code, title, office_type, start_date) values ($1, 'Minister for Health', 'cabinet', '2025-01-23')", [M]);
    await q("insert into politics.td_offices (member_code, title, office_type, start_date) values ($1, 'Minister of State at the Department of Health', 'minister_of_state', '2025-01-29')", [K]);
    await addSection(PQ, 'questions', 'Hospital Waiting Lists', [
      [0, A, `Will the Minister publish the waiting list plan? ${words(30)}`],
      [1, M, 'I will publish the waiting list plan in November. I will revert to the Deputy on the figures.'],
      [2, B, `What about Cork? ${words(20)}`],
      [3, M, 'We will do everything we can for Cork.'],
      [4, S, 'What about Kerry?'],
      [5, K, 'Hear, hear.'],
    ]);
    await addSection(TI, 'topical_issue', 'School Transport', [
      [0, G, `I raise school transport in my county. ${words(60)}`],
      [1, M, 'We are going to fund forty new bus routes from September.'],
    ]);
    await addSection(LQ, 'leaders_questions', "Leaders' Questions", [
      [0, A, `The Taoiseach must answer for the hospital crisis. ${words(300)}`],
      [1, M, 'The Government has a plan and it is working.'],
      [2, B, `The Taoiseach has ignored the housing crisis entirely. ${words(300)}`],
      [3, M, 'I reject that.'],
    ]);
    await q('insert into politics.question_askers (section_id, question_number, member_code, date) values ($1, 4, $2, $3), ($1, 5, $4, $3)', [PQ, A, DAY, B]);
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('cuts each section into exchanges by its format', async () => {
    expect(await repo.rebuildQuestionExchanges()).toEqual({ sections: 3, exchanges: 4 });
    const { rows } = await q('select id, format, askers, from_position, to_position from politics.question_exchanges order by id');
    expect(rows).toEqual([
      { id: `${LQ}#1`, format: 'leaders_questions', askers: [A], from_position: 0, to_position: 1 },
      { id: `${LQ}#2`, format: 'leaders_questions', askers: [B], from_position: 2, to_position: 3 },
      { id: `${PQ}#1`, format: 'oral_pq', askers: [A, B], from_position: 0, to_position: 5 },
      { id: `${TI}#1`, format: 'topical_issue', askers: [G], from_position: 0, to_position: 1 },
    ]);
    expect((await repo.questionUnits()).map((u) => [u.id, u.format])).toContainEqual([`${PQ}#1`, 'oral_pq']);
    expect((await repo.exchangeSpeechesOf(`${PQ}#1`)).map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5].map((n) => `${PQ}/spk_${n}`));
  });

  it('scores an action commitment for each asker across the House, never for a government backbencher', async () => {
    await item(`${PQ}/spk_1`, M, 'commitment', 'I will publish the waiting list plan in November', 'action');
    await item(`${PQ}/spk_1`, M, 'commitment', 'I will revert to the Deputy on the figures', 'follow_up');
    await item(`${PQ}/spk_3`, M, 'commitment', 'We will do everything we can for Cork', 'general');
    await item(`${TI}/spk_1`, M, 'commitment', 'We are going to fund forty new bus routes', 'action');
    await item(`${TI}/spk_1`, M, 'specific_claim', 'forty new bus routes from September', null);
    for (const id of [`${PQ}#1`, `${TI}#1`, `${LQ}#1`]) await markRead(id);
    expect(await repo.rebuildQuestionRecord()).toEqual({ rows: 9 });
    const { rows } = await q(
      `select exchange_id, member_code, role, government_side, asked, secured, follow_ups, answered, answer_claims, answer_commitments, points
       from politics.question_participation order by exchange_id, member_code`,
    );
    const by = (exchange: string, member: string) => rows.find((r) => r.exchange_id === exchange && r.member_code === member);
    // Both askers of the grouped PQs: one action (the plan), so 2 points each; the follow-up is counted, the general one is not scored.
    expect(by(`${PQ}#1`, A)).toMatchObject({ asked: true, government_side: false, secured: 1, follow_ups: 1, points: 2 });
    expect(by(`${PQ}#1`, B)).toMatchObject({ asked: true, secured: 1, points: 2 });
    expect(by(`${PQ}#1`, M)).toMatchObject({ role: 'office', answered: true, answer_commitments: 1, points: 0 });
    // The Minister of State who only interjected did not answer; nor did the member who only interjected ask.
    expect(by(`${PQ}#1`, K)).toMatchObject({ role: 'office', answered: false });
    expect(by(`${PQ}#1`, S)).toMatchObject({ asked: false, answered: false, points: 0 });
    // A government backbencher secured a commitment, which scores nothing.
    expect(by(`${TI}#1`, G)).toMatchObject({ government_side: true, secured: 1, points: 0 });
    expect(by(`${TI}#1`, M)).toMatchObject({ answer_claims: 1, answer_commitments: 1 });
    // LQ#2 was never read, so it has no rows.
    expect(rows.filter((r) => r.exchange_id === `${LQ}#2`)).toEqual([]);
  });

  it("shows a TD's record per format and the commitments made to them, and a section's exchanges", async () => {
    const a = await repo.tdQuestionRecord(await tdIdOf(A));
    expect(a?.formats.find((f) => f.format === 'oral_pq')).toMatchObject({ asked: 1, askedAcross: 1, securedExchanges: 1, points: 2, followUps: 1, perTen: null });
    expect(a?.recent.map((x) => [x.exchangeId, x.date, x.title, x.commitments.map((c) => c.type)])).toEqual([[`${PQ}#1`, DAY, 'Hospital Waiting Lists', ['action', 'follow_up', 'general']]]);
    expect((await repo.tdQuestionRecord(await tdIdOf(M)))?.answers).toEqual({ answered: 3, withClaim: 1, withCommitment: 2 });
    // A government backbencher's question counts in no rate: the commitment they drew is not one secured.
    expect((await repo.tdQuestionRecord(await tdIdOf(G)))?.formats).toEqual([
      expect.objectContaining({ format: 'topical_issue', asked: 1, askedAcross: 0, securedExchanges: 0, perTen: null }),
    ]);
    // Only interjecting, as a member or a minister, leaves no record.
    expect(await repo.tdQuestionRecord(await tdIdOf(S))).toBeNull();
    expect(await repo.tdQuestionRecord(await tdIdOf(K))).toBeNull();
    const view = await repo.questionRecord(PQ);
    expect(view?.exchanges.map((x) => [x.askers.map((s) => [s.name, s.points]), x.commitments.length])).toEqual([[[['Ann Opp', 2], ['Ben Opp', 2]], 3]]);
    expect(await repo.questionRecord('dail-2099-01-01-dbsect_1')).toBeNull();
  });

  it('never lets a question item into the debate record', async () => {
    expect(await repo.rebuildDebateRecord()).toEqual({ debates: 0, rows: 0 });
  });

  it('lists recent commitments newest first: by day, then section and exchange number as numbers', async () => {
    const askers = [B, A, B, G, B, G, B, G, B, A];
    await addSection(
      RQ,
      'questions',
      'Questions on Promised Legislation',
      askers.flatMap((who, k): Array<[number, string, string]> => [[2 * k, who, words(50)], [2 * k + 1, M, 'I will revert to the Deputy on that.']]),
    );
    expect(await repo.rebuildQuestionExchanges()).toEqual({ sections: 4, exchanges: 14 });
    // A asked #2 and #10, and the minister offered to revert in both.
    for (const [n, speech] of [[2, 3], [10, 19]]) {
      await item(`${RQ}/spk_${speech}`, M, 'commitment', 'I will revert to the Deputy', 'follow_up');
      await markRead(`${RQ}#${n}`);
    }
    await repo.rebuildQuestionRecord();
    expect((await repo.tdQuestionRecord(await tdIdOf(A)))?.recent.map((x) => x.exchangeId)).toEqual([`${RQ}#10`, `${RQ}#2`, `${PQ}#1`]);
  });

  it('drops the read of an exchange whose span or askers changed or that is gone, and keeps the rest', async () => {
    await markRead(`${LQ}#2`);
    // Without B's question, LQ#1 runs to the end of the section and LQ#2 is gone.
    await q('delete from politics.debate_speeches where id = $1', [`${LQ}/spk_2`]);
    expect(await repo.rebuildQuestionExchanges()).toEqual({ sections: 4, exchanges: 13 });
    const runs = (await q("select debate_id from politics.debate_extraction_runs where extractor_version = 'q1'")).rows.map((r) => r.debate_id as string);
    expect(runs.sort()).toEqual([`${PQ}#1`, `${TI}#1`, `${RQ}#2`, `${RQ}#10`].sort());
    // Until LQ#1 is read again, nothing in it counts.
    await repo.rebuildQuestionRecord();
    expect((await q('select count(*)::int n from politics.question_participation where exchange_id like $1', [`${LQ}#%`])).rows[0].n).toBe(0);
  });
});

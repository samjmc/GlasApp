/**
 * The debate record against a real Postgres: the rebuild turns stored items into points by the
 * published rules, and the two reads (one debate, one TD) show what was said and who scored.
 * Skipped unless TEST_DATABASE_URL is set; uses its own database, `<db>_debaterecord`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55433/postgres"
 *   npx vitest run server/parliament/repo/debateRecord.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../../testing/migrations';

const url = testDatabaseUrl('debaterecord');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const DAY = '2026-09-23';
const DEBATE = `dail-${DAY}-dbsect_5`;
const UNREAD = `dail-${DAY}-dbsect_9`;
const A = 'Ann-Opp.D.2020-02-08'; // Sinn Féin
const B = 'Bob-Min.D.2016-10-03'; // Fianna Fáil, Minister of State
const C = 'Cat-Ind.D.2024-11-29'; // Independent, no office
const sp = (n: number) => `${DEBATE}/spk_${n}`;

run('debate record (real Postgres)', () => {
  let dbmod: typeof import('../../db');
  let repo: typeof import('../repository');
  let version: string;
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);
  const tdIdOf = async (code: string) => (await q('select id from politics.tds where member_code = $1', [code])).rows[0].id as number;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('../repository');
    version = (await import('../debateItems/prompt')).EXTRACTOR_VERSION;

    for (const [code, name, party] of [[A, 'Ann Opp', 'Sinn Féin'], [B, 'Bob Min', 'Fianna Fáil'], [C, 'Cat Ind', 'Independent']]) {
      await q('insert into politics.tds (name, member_code, party) values ($1, $2, $3)', [name, code, party]);
    }
    await q("insert into politics.td_offices (member_code, title, office_type, start_date) values ($1, 'Minister of State at the Department of Health', 'minister_of_state', '2025-01-23')", [B]);
    for (const id of [DEBATE, UNREAD]) {
      await q("insert into politics.debates (id, kind, title, first_date, last_date, section_count) values ($1, 'motion', 'Health: Motion', $2, $2, 1)", [id, DAY]);
      await q("insert into politics.debate_sections (id, date, title, speech_count, debate_id) values ($1, $2, 'Health: Motion', 3, $1)", [id, DAY]);
    }
    const speeches: Array<[string, string, string]> = [
      [sp(1), A, 'One: 1 more. Two: 2 more. Three: 3 more. Four: 4 more. Will the Minister act now?'],
      [sp(2), B, 'The Deputy is right about the waiting lists. I will publish the plan this year.'],
      [sp(3), C, 'I agree with the Minister of State on this point entirely.'],
      [`${UNREAD}/spk_1`, A, 'Words that were never read for items.'],
      [`${UNREAD}/spk_2`, C, 'Nor these.'],
      [sp(4), A, 'As Deputy Min said, the plan matters. More words here.'],
      // The debate's last speech: the minister's closing reply.
      [sp(5), B, 'Deputy Opp raised the waiting lists. That is fair.'],
    ];
    for (const [i, [id, member, text]] of speeches.entries()) {
      await q('insert into politics.debate_speeches (id, section_id, date, position, member_code, text, word_count) values ($1, $2, $3, $4, $5, $6, $7)', [
        id,
        id.split('/')[0],
        DAY,
        i,
        member,
        text,
        text.split(' ').length,
      ]);
    }
    const item = (speechId: string, member: string, kind: string, quote: string, extra: Record<string, unknown> = {}) =>
      q(
        `insert into politics.debate_items (speech_id, member_code, kind, claim_type, quote, quote_start, quote_end, target_speech_id, addressee, due, extractor_version)
         values ($1, $2, $3, $4, $5, 0, 1, $6, $7, $8, $9)`,
        [speechId, member, kind, extra.claimType ?? null, quote, extra.target ?? null, extra.addressee ?? null, extra.due ?? null, extra.version ?? version],
      );
    for (const n of ['One: 1 more', 'Two: 2 more', 'Three: 3 more', 'Four: 4 more']) await item(sp(1), A, 'specific_claim', n, { claimType: 'figure' });
    await item(sp(1), A, 'question', 'Will the Minister act now?', { addressee: 'the Minister' });
    await item(sp(2), B, 'concession', 'The Deputy is right about the waiting lists', { target: sp(1) }); // government to opposition: scores for A
    await item(sp(2), B, 'commitment', 'I will publish the plan this year', { due: 'this year' });
    await item(sp(3), C, 'concession', 'I agree with the Minister of State on this point', { target: sp(2) }); // independent (no office) to government: scores for B
    await item(sp(3), C, 'response', 'I agree with the Minister of State', { target: sp(2) }); // names nobody (Bob spoke in no role): hidden
    await item(sp(4), A, 'response', 'As Deputy Min said', { target: sp(2) }); // names Bob, another party: scores for B
    await item(sp(5), B, 'response', 'Deputy Opp raised the waiting lists', { target: sp(1) }); // the closing speech: shown, no points
    await item(sp(1), A, 'specific_claim', 'An item from an older version', { claimType: 'figure', version: 'v0' });
    await item(`${UNREAD}/spk_1`, A, 'specific_claim', 'Words that were never read', { claimType: 'figure' });

    await q(
      `insert into politics.debate_extraction_runs (debate_id, extractor_version, input_hash, status, speeches, words, irish_speeches, calls, prompt_tokens, completion_tokens, accepted)
       values ($1, $2, 'h', 'done', 3, 40, 0, 1, 1, 1, 8), ($3, $2, 'h', 'failed', 2, 8, 0, 1, 1, 1, 0)`,
      [DEBATE, version, UNREAD],
    );
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('rebuilds points from the stored items, only for debates whose read finished', async () => {
    expect(await repo.rebuildDebateRecord()).toEqual({ debates: 1, rows: 3 });
    const { rows } = await q(
      `select member_code, role, claims, claim_points, concessions_received, concession_points, replies, taken_up, taken_up_points, questions, commitments, points
       from politics.debate_participation order by member_code`,
    );
    expect(rows).toEqual([
      { member_code: A, role: 'backbench', claims: 4, claim_points: 3, concessions_received: 1, concession_points: 3, replies: 1, taken_up: 0, taken_up_points: 0, questions: 1, commitments: 0, points: 6 },
      { member_code: B, role: 'office', claims: 0, claim_points: 0, concessions_received: 1, concession_points: 3, replies: 1, taken_up: 1, taken_up_points: 2, questions: 0, commitments: 1, points: 5 },
      { member_code: C, role: 'backbench', claims: 0, claim_points: 0, concessions_received: 0, concession_points: 0, replies: 0, taken_up: 0, taken_up_points: 0, questions: 0, commitments: 0, points: 0 },
    ]);
    // Rebuilding again gives the same rows.
    expect(await repo.rebuildDebateRecord()).toEqual({ debates: 1, rows: 3 });
  });

  it('shows one debate: most points first, with what each member said, and only replies that name their target', async () => {
    const view = await repo.debateRecord(DEBATE);
    expect(view).toMatchObject({ debateId: DEBATE, title: 'Health: Motion', kind: 'motion', rulesVersion: 'r2' });
    expect(view!.participants.map((p) => [p.name, p.points, p.items.map((i) => i.kind)])).toEqual([
      ['Ann Opp', 6, ['specific_claim', 'specific_claim', 'specific_claim', 'specific_claim', 'question', 'response']],
      ['Bob Min', 5, ['concession', 'commitment', 'response']],
      ['Cat Ind', 0, ['concession']],
    ]);
    expect(view!.participants[1].items[0]).toMatchObject({ kind: 'concession', speaker: 'Bob Min', to: 'Ann Opp', crossesHouse: true });
    expect(view!.participants[0].items[5]).toMatchObject({ kind: 'response', quote: 'As Deputy Min said', to: 'Bob Min', replyNoPoints: null });
    expect(view!.participants[1].items[2]).toMatchObject({ kind: 'response', to: 'Ann Opp', replyNoPoints: 'closing_speech' });
    expect(view!.participants[1]).toMatchObject({ takenUp: 1, takenUpPoints: 2, replies: 1 });
    expect(await repo.debateRecord(UNREAD)).toBeNull();
    expect(await repo.debateRecord('dail-2099-01-01-dbsect_1')).toBeNull();
  });

  it("shows a TD's record: role, totals, recent debates, and the concessions and replies made to them", async () => {
    const a = await repo.tdDebateRecord(await tdIdOf(A));
    expect(a).toMatchObject({
      role: 'backbench',
      debates: 1,
      points: 6,
      pointsPerDebate: null, // one debate is below the minimum
      cohortSize: 0,
      totals: { claims: 4, claimPoints: 3, concessionsReceived: 1, concessionPoints: 3, replies: 1, takenUp: 0, takenUpPoints: 0, questions: 1, commitments: 0 },
    });
    expect(a!.recent).toHaveLength(1);
    expect(a!.recent[0].items).toHaveLength(6);
    expect(a!.recent[0].toThem.map((i) => [i.kind, i.speaker, i.quote])).toEqual([
      ['concession', 'Bob Min', 'The Deputy is right about the waiting lists'],
      ['response', 'Bob Min', 'Deputy Opp raised the waiting lists'],
    ]);
    const b = await repo.tdDebateRecord(await tdIdOf(B));
    expect(b?.role).toBe('office');
    expect(b?.totals).toMatchObject({ takenUp: 1, takenUpPoints: 2 });
    // The reply that names nobody is not shown to the member it was linked to either.
    expect(b!.recent[0].toThem.map((i) => [i.kind, i.speaker])).toEqual([
      ['concession', 'Cat Ind'],
      ['response', 'Ann Opp'],
    ]);
    expect(await repo.tdDebateRecord(99999)).toBeNull();
  });

  it("keeps a debate's older finished read until the new version reaches it, and never mixes versions", async () => {
    const { EXTRACTOR_VERSIONS } = await import('../debateItems/prompt');
    const previous = EXTRACTOR_VERSIONS[EXTRACTOR_VERSIONS.length - 2]!;
    // UNREAD: the current version's read failed (a stopped run), but the previous version finished.
    // DEBATE: both finished, so only the current version's items count.
    await q(
      `insert into politics.debate_extraction_runs (debate_id, extractor_version, input_hash, status, speeches, words, irish_speeches, calls, prompt_tokens, completion_tokens, accepted)
       values ($1, $3, 'h', 'done', 2, 8, 0, 1, 1, 1, 1), ($2, $3, 'h', 'done', 3, 40, 0, 1, 1, 1, 1)`,
      [UNREAD, DEBATE, previous],
    );
    for (const [speechId, member, quote] of [[`${UNREAD}/spk_1`, A, 'Words that were never'], [sp(1), A, 'Will the Minister act']]) {
      await q(
        `insert into politics.debate_items (speech_id, member_code, kind, claim_type, quote, quote_start, quote_end, extractor_version) values ($1, $2, 'specific_claim', 'figure', $3, 0, 1, $4)`,
        [speechId, member, quote, previous],
      );
    }
    expect(await repo.rebuildDebateRecord()).toEqual({ debates: 2, rows: 5 });
    const claimsOf = async (debateId: string) =>
      (await q('select member_code, claims from politics.debate_participation where debate_id = $1 order by member_code', [debateId])).rows;
    // UNREAD counts its previous-version claim, not the current version's item from the failed run.
    expect(await claimsOf(UNREAD)).toEqual([{ member_code: A, claims: 1 }, { member_code: C, claims: 0 }]);
    expect((await repo.debateRecord(UNREAD))?.participants.find((p) => p.memberCode === A)?.items.map((i) => i.quote)).toEqual(['Words that were never']);
    // DEBATE still counts only the current version's 4 claims.
    expect((await claimsOf(DEBATE)).find((r) => r.member_code === A)).toEqual({ member_code: A, claims: 4 });
  });
});

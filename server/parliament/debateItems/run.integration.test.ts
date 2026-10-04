/**
 * The extractor against a real Postgres, with a fake model: what it stores, that it reads a
 * debate once per version, that a changed speech is read again, that a failure stores no items,
 * and that re-reading a sitting day (which deletes and re-inserts its speeches) keeps the items.
 * Skipped unless TEST_DATABASE_URL is set; uses its own database, `<db>_debateitems`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55433/postgres"
 *   npx vitest run server/parliament/debateItems/run.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../../testing/migrations';
import type { ItemAnswer, ItemCompletion } from './run';

const url = testDatabaseUrl('debateitems');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const A = 'Ann-Murphy.D.2020-02-08';
const B = 'Mary-Butler.D.2016-10-03';
const DAY = '2026-09-23';
const SECTION = `dail-${DAY}-dbsect_5`;
const SPEECHES = [
  { id: `${SECTION}/spk_1`, member: A, text: 'The waiting list now stands at 600,000 people and that is a disgrace.' },
  { id: `${SECTION}/spk_2`, member: B, text: 'The Deputy is right that the list is too long. We have hired 2,000 nurses since January. I will publish the plan by the end of the year.' },
];

/** The reply the fake model gives for the motion debate: three good items, one bad quote. */
const REPLY = {
  items: [
    { speech: 's2', kind: 'specific_claim', claim_type: 'figure', quote: 'We have hired 2,000 nurses' },
    { speech: 's2', kind: 'concession', quote: 'The Deputy is right that the list is too long', target_speech: 's1' },
    { speech: 's2', kind: 'commitment', quote: 'I will publish the plan', due: 'by the end of the year' },
    { speech: 's1', kind: 'specific_claim', claim_type: 'figure', quote: 'The waiting list is 900,000' },
  ],
};

function fake(reply: unknown = REPLY): ItemCompletion & { calls: number } {
  const f = (async () => {
    f.calls++;
    return { content: JSON.stringify(reply), model: 'fake-model', promptTokens: 1000, completionTokens: 200 } satisfies ItemAnswer;
  }) as ItemCompletion & { calls: number };
  f.calls = 0;
  return f;
}

run('debate items (real Postgres)', () => {
  let dbmod: typeof import('../../db');
  let items: typeof import('./run');
  let repo: typeof import('../repository');
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);
  const stored = async () =>
    (await q('select speech_id, member_code, kind, claim_type, quote, target_speech_id, due from politics.debate_items order by id')).rows;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../../db');
    await applyAllMigrations(dbmod.pool);
    items = await import('./run');
    repo = await import('../repository');

    for (const [code, name] of [[A, 'Ann Murphy'], [B, 'Mary Butler']]) await q('insert into politics.tds (name, member_code) values ($1, $2)', [name, code]);
    await q("insert into politics.td_offices (member_code, title, office_type, start_date) values ($1, 'Minister of State at the Department of Health', 'minister_of_state', '2025-01-23')", [B]);
    await q("insert into politics.debates (id, kind, title, first_date, last_date, section_count) values ($1, 'motion', 'Health: Motion', $2, $2, 1)", [SECTION, DAY]);
    await q("insert into politics.debate_sections (id, date, title, speech_count, debate_id) values ($1, $2, 'Health: Motion', 2, $1)", [SECTION, DAY]);
    for (const [i, s] of SPEECHES.entries()) {
      await q('insert into politics.debate_speeches (id, section_id, date, position, member_code, text, word_count) values ($1, $2, $3, $4, $5, $6, $7)', [
        s.id,
        SECTION,
        DAY,
        i,
        s.member,
        s.text,
        s.text.split(' ').length,
      ]);
    }
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('stores the items code accepted, and the run with its tokens and rejections', async () => {
    const complete = fake();
    const s = await items.extractDebates({ complete });
    expect(complete.calls).toBe(1);
    expect(s).toMatchObject({ debates: 1, done: 1, failed: 0, skipped: 0, calls: 1, promptTokens: 1000, completionTokens: 200 });
    expect(s.acceptedByKind).toMatchObject({ specific_claim: 1, concession: 1, commitment: 1 });
    expect(s.rejected.quote_not_found).toEqual({ en: 1, ga: 0 });
    expect(await stored()).toEqual([
      { speech_id: SPEECHES[1].id, member_code: B, kind: 'specific_claim', claim_type: 'figure', quote: 'We have hired 2,000 nurses', target_speech_id: null, due: null },
      { speech_id: SPEECHES[1].id, member_code: B, kind: 'concession', claim_type: null, quote: 'The Deputy is right that the list is too long', target_speech_id: SPEECHES[0].id, due: null },
      { speech_id: SPEECHES[1].id, member_code: B, kind: 'commitment', claim_type: null, quote: 'I will publish the plan', target_speech_id: null, due: 'by the end of the year' },
    ]);
    const { rows } = await q('select status, calls, accepted, rejected, model, speeches, words from politics.debate_extraction_runs');
    expect(rows).toEqual([{ status: 'done', calls: 1, accepted: 3, rejected: { quote_not_found: { en: 1, ga: 0 } }, model: 'fake-model', speeches: 2, words: 41 }]);
  });

  it('reads a debate once per version: a second run makes no call', async () => {
    const complete = fake();
    const s = await items.extractDebates({ complete });
    expect(complete.calls).toBe(0);
    expect(s).toMatchObject({ skipped: 1, done: 0 });
    expect(await stored()).toHaveLength(3);
  });

  it('keeps the items when a sitting day is re-read, which deletes and re-inserts its speeches', async () => {
    const day = (await q('select * from politics.debate_speeches where date = $1 order by position', [DAY])).rows;
    await repo.replaceDebateDay(
      DAY,
      [{ id: SECTION, date: DAY, title: 'Health: Motion', parentId: null, parentTitle: null, debateId: SECTION, speechCount: 2 }],
      day.map((r) => ({ id: r.id, sectionId: r.section_id, date: DAY, position: r.position, memberCode: r.member_code, role: null, isPresiding: false, text: r.text, wordCount: r.word_count })),
      new Map(),
    );
    expect(await stored()).toHaveLength(3);
    const complete = fake();
    expect(await items.extractDebates({ complete })).toMatchObject({ skipped: 1 });
    expect(complete.calls).toBe(0);
  });

  it('reads a debate again when a speech changes, replacing its items', async () => {
    await q("update politics.debate_speeches set text = text || ' Thank you.' where id = $1", [SPEECHES[1].id]);
    const complete = fake({ items: [REPLY.items[0]] });
    const s = await items.extractDebates({ complete });
    expect(complete.calls).toBe(1);
    expect(s).toMatchObject({ done: 1, skipped: 0 });
    expect((await stored()).map((r) => r.kind)).toEqual(['specific_claim']);
  });

  it('stores no items for a failed read, keeps the earlier ones, and tries again next time', async () => {
    await q("update politics.debate_speeches set text = text || ' Again.' where id = $1", [SPEECHES[1].id]);
    const broken: ItemCompletion = async () => {
      throw new Error('model down');
    };
    const s = await items.extractDebates({ complete: broken });
    expect(s).toMatchObject({ failed: 1, done: 0 });
    expect((await q('select status, error from politics.debate_extraction_runs')).rows).toEqual([{ status: 'failed', error: 'model down' }]);
    expect(await stored()).toHaveLength(1);

    const unusable: ItemCompletion = async () => ({ content: 'not json', model: 'fake-model', promptTokens: 10, completionTokens: 1 });
    expect(await items.extractDebates({ complete: unusable })).toMatchObject({ failed: 1 });

    const complete = fake();
    expect(await items.extractDebates({ complete })).toMatchObject({ done: 1 });
    expect(await stored()).toHaveLength(3);
  });

  it('reads a window again in two halves when the reply is cut off at the output limit', async () => {
    await q("update politics.debate_speeches set text = text || ' Cut.' where id = $1", [SPEECHES[1].id]);
    const cut = { content: '{"items": [{"speech": "s2", "kind": "spec', model: 'fake-model', promptTokens: 1000, completionTokens: 8192, truncated: true } satisfies ItemAnswer;

    // Cut off every time: the window is halved once, and a single speech is never split.
    let calls = 0;
    const alwaysCut: ItemCompletion = async () => {
      calls++;
      return cut;
    };
    expect(await items.extractDebates({ complete: alwaysCut })).toMatchObject({ failed: 1, calls: 2 });
    expect(calls).toBe(2);
    expect((await q('select status, error from politics.debate_extraction_runs')).rows).toEqual([{ status: 'failed', error: 'model output cut off at the token limit' }]);
    expect(await stored()).toHaveLength(3);

    // Cut off once: both halves are read, and the items are the same as from one window.
    calls = 0;
    const firstCut: ItemCompletion = async () =>
      calls++ === 0 ? cut : { content: JSON.stringify(REPLY), model: 'fake-model', promptTokens: 1000, completionTokens: 200 };
    const s = await items.extractDebates({ complete: firstCut });
    expect(calls).toBe(3);
    expect(s).toMatchObject({ done: 1, failed: 0, calls: 3 });
    expect(s.acceptedByKind).toMatchObject({ specific_claim: 1, concession: 1, commitment: 1 });
    expect((await stored()).map((r) => r.kind)).toEqual(['specific_claim', 'concession', 'commitment']);
  });

  it('writes nothing on a dry run', async () => {
    await q("update politics.debate_speeches set text = text || ' Once more.' where id = $1", [SPEECHES[1].id]);
    const before = (await q('select ran_at from politics.debate_extraction_runs')).rows[0].ran_at;
    const s = await items.extractDebates({ complete: fake({ items: [] }), dryRun: true });
    expect(s).toMatchObject({ done: 1 });
    expect(await stored()).toHaveLength(3);
    expect((await q('select ran_at from politics.debate_extraction_runs')).rows[0].ran_at).toEqual(before);
  });

  it('stops at the first "no credit" reply instead of failing every debate after it', async () => {
    const second = `dail-${DAY}-dbsect_9`;
    await q("insert into politics.debates (id, kind, title, first_date, last_date, section_count) values ($1, 'statements', 'Housing: Statements', $2, $2, 1)", [second, DAY]);
    await q("insert into politics.debate_sections (id, date, title, speech_count, debate_id) values ($1, $2, 'Housing: Statements', 2, $1)", [second, DAY]);
    for (const [i, s] of SPEECHES.entries()) {
      await q('insert into politics.debate_speeches (id, section_id, date, position, member_code, text, word_count) values ($1, $2, $3, $4, $5, $6, $7)', [
        `${second}/spk_${i + 1}`,
        second,
        DAY,
        i,
        s.member,
        s.text,
        s.text.split(' ').length,
      ]);
    }
    await q("update politics.debate_speeches set text = text || ' Still.' where id = $1", [SPEECHES[1].id]);
    let calls = 0;
    const noCredit: ItemCompletion = async () => {
      calls++;
      throw Object.assign(new Error('402 Insufficient Balance'), { status: 402 });
    };
    const s = await items.extractDebates({ complete: noCredit, concurrency: 1 });
    expect(calls).toBe(1);
    expect(s).toMatchObject({ debates: 2, failed: 1, done: 0 });
    expect(s.stopped).toContain('no credit');
    expect(s.results).toHaveLength(1);

    // With credit again, both are read.
    expect(await items.extractDebates({ complete: fake() })).toMatchObject({ done: 2 });
  });

  it('removes items whose speech left the record', async () => {
    await q('delete from politics.debate_speeches where id = $1', [SPEECHES[0].id]); // the concession's target
    const s = await items.extractDebates({ complete: fake() });
    expect(s.orphansRemoved).toBe(1);
    const { rows } = await q('select count(*)::int n from politics.debate_items where speech_id = $1 or target_speech_id = $1', [SPEECHES[0].id]);
    expect(rows[0].n).toBe(0);
    // The other debate's concession points at its own speech, and stays.
    expect((await stored()).filter((r) => r.kind === 'concession')).toHaveLength(1);
  });
});

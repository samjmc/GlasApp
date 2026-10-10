/**
 * Dáil divisions as fixed-option stances against a real Postgres (01c): the schema, the reading
 * cache with its candidate window and re-checks, the sync into td_stances, the rebuild of all
 * `stance` evidence, the lock, the nightly run and its guard, and what the TD page and a user's
 * matches show. Every model call is a stub; nothing here reaches a model.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_divisions`.
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/stances/divisions.integration.test.ts
 */
import type { Server } from 'node:http';
import express from 'express';
import pkg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';
import type { DivisionCompletion } from './divisions';

const divisionsUrl = testDatabaseUrl('divisions');
const run = describe.skipIf(!divisionsUrl);

if (divisionsUrl) {
  process.env.DATABASE_URL = divisionsUrl;
  process.env.LOG_LEVEL = 'silent';
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const NOW = new Date('2026-10-01T12:00:00Z');
const later = (days: number) => new Date(NOW.getTime() + days * 86_400_000);
const MOTION = 'That Dáil Éireann calls on the Government to build fifty thousand public homes every year on public land.';
const QUOTE = 'calls on the Government to build fifty thousand public homes every year';
// Four axes each, so an Independent with one of these on record is measured on enough
// dimensions (plan 03's MIN_MEASURED_DIMS) to be listed in a user's matches.
const OPTIONS = [
  { key: 'option_a', label: 'Build public homes', economic: -2, welfare: -1, social: -1, environmental: -1 },
  { key: 'option_b', label: 'Leave it to the market', economic: 2, welfare: 1, social: 1, environmental: 1 },
  { key: 'option_c', label: 'Mix of both', economic: 0, welfare: 0, social: 0, environmental: 0 },
];

type Reply = (user: string) => unknown;
const meaningReply: Reply = () => ({ procedural: false, division_kind: 'motion', ta_means: 'Build public homes.', quote_block: 'M1', quote: QUOTE, policy_domains: ['housing'], confidence: 0.9 });
const firstCandidate = (user: string) => Number(user.match(/question_id (\d+)/)![1]);
const matchReply: Reply = (user) => ({ question_id: firstCandidate(user), ta_option: 'option_a', nil_option: 'option_b', confidence: 0.9, reason: 'stated' });

run('division stances against Postgres', { timeout: 60_000 }, () => {
  let dbmod: typeof import('../db');
  let divisions: typeof import('./divisions');
  let ideology: typeof import('../ideology');
  let ideologyRepo: typeof import('../ideology/repository');
  let stancesRepo: typeof import('./repository');
  let voting: typeof import('../voting/service');
  let MEANING_SYSTEM_PROMPT: string;
  let MATCH_PROMPT_VERSION: number;
  let nextArticle = 5000;
  let nextSection = 1;

  const q = <T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    dbmod.pool.query<T>(text, params).then((r) => r.rows);

  /** A stub model; `calls` records which call each was. */
  function stub(o: { meaning?: Reply; match?: Reply } = {}) {
    const calls: Array<'meaning' | 'match'> = [];
    const complete: DivisionCompletion = async (system, user) => {
      const kind = system === MEANING_SYSTEM_PROMPT ? 'meaning' : 'match';
      calls.push(kind);
      const reply = (kind === 'meaning' ? (o.meaning ?? meaningReply) : (o.match ?? matchReply))(user);
      return { content: typeof reply === 'string' ? reply : JSON.stringify(reply), model: 'stub-model', promptTokens: 100, completionTokens: 20 };
    };
    return { complete, calls };
  }

  async function addTd(name: string, party: string | null, active = true): Promise<number> {
    const [row] = await q<{ id: number }>('insert into politics.tds (name, party, is_active) values ($1, $2, $3) returning id', [name, party, active]);
    return row!.id;
  }

  /** A daily-vote question with the three OPTIONS (weight 1, no confidence). */
  async function addQuestion(domain: string, publishedAt: string): Promise<number> {
    const [row] = await q<{ id: number }>(
      `insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline, published_at)
       values ($1, $2, $3, $4, 'h', $5) returning id`,
      [nextArticle++, `How should the State act on ${domain}?`, domain, `${domain}_topic`, publishedAt],
    );
    for (const [i, o] of OPTIONS.entries()) {
      await q(
        'insert into politics.policy_question_options (question_id, option_key, label, position, economic, welfare, social, environmental) values ($1, $2, $3, $4, $5, $6, $7, $8)',
        [row!.id, o.key, o.label, i, o.economic, o.welfare, o.social, o.environmental],
      );
    }
    return row!.id;
  }

  /** A division with its own debate section holding one "I move" speech (none with `motion: null`). */
  async function addDivision(date: string, vote: number, opts: { motion?: string | null; subject?: string } = {}): Promise<string> {
    const id = `dail-34-${date}-vote_${vote}`;
    const section = `dail-${date}-dbsect_${nextSection++}`;
    const motion = opts.motion === undefined ? MOTION : opts.motion;
    await q("insert into politics.debate_sections (id, date, title, speech_count) values ($1, $2, 'Housing: Motion', 1)", [section, date]);
    if (motion) {
      await q('insert into politics.debate_speeches (id, section_id, date, position, text, word_count) values ($1, $2, $3, 0, $4, 20)', [
        `${section}/spk_1`,
        section,
        date,
        `I move:\n\n${motion}`,
      ]);
    }
    await q(
      `insert into politics.divisions (id, uri, house_no, date, subject, debate_section_id, ta_count, nil_count, staon_count)
       values ($1, $2, 34, $3, $4, $5, 10, 10, 0)`,
      [id, `test:${id}`, date, opts.subject ?? 'Question put', section],
    );
    return id;
  }

  async function vote(divisionId: string, tdId: number, how: 'ta' | 'nil' | 'staon'): Promise<void> {
    await q('insert into politics.division_votes (division_id, member_code, td_id, vote) values ($1, $2, $3, $4)', [divisionId, `member-${tdId}`, tdId, how]);
  }

  const readings = () => q('select * from politics.division_readings order by division_id');
  const stances = () =>
    q<{ td_id: number; division_id: string | null; division_vote: string | null; discipline: string | null; option_key: string | null; quote_kind: string }>(
      'select * from politics.td_stances order by td_id, id',
    );
  const evidence = () =>
    q<{ td_id: number; source_ref: string; weight: number; economic: number | null; observed_at: Date }>(
      "select * from politics.td_ideology_evidence where source = 'stance' order by td_id, source_ref",
    );
  const classify = (complete: DivisionCompletion, over: Parameters<typeof divisions.classifyDivisions>[0] = {}) =>
    divisions.classifyDivisions({ complete, now: NOW, ...over });
  const nightly = (complete: DivisionCompletion, llmConfigured = true, now = NOW) =>
    divisions.runDivisionStances({ mode: 'nightly', complete, llmConfigured, now, log: () => {} });

  /** One matched division: SF 5 Tá + 1 Níl, a Níl Independent, a Tá '100% RDR', a Tá Green, and a retired Tá TD. */
  async function seedLobbies() {
    const question = await addQuestion('housing', '2026-09-25T09:00:00Z');
    const peers = [];
    for (let i = 1; i <= 5; i++) peers.push(await addTd(`SF Peer ${i}`, 'Sinn Féin'));
    const rebel = await addTd('SF Rebel', 'Sinn Féin');
    const independent = await addTd('Ind Voter', 'Independent');
    const rdr = await addTd('RDR Voter', '100% RDR');
    const green = await addTd('Green Voter', 'Green Party');
    const d1 = await addDivision('2026-09-24', 1);
    for (const id of peers) await vote(d1, id, 'ta');
    await vote(d1, rebel, 'nil');
    await vote(d1, independent, 'nil');
    await vote(d1, rdr, 'ta');
    await vote(d1, green, 'ta');
    return { question, peers, rebel, independent, rdr, green, d1 };
  }

  beforeAll(async () => {
    await ensureDatabase(divisionsUrl!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    divisions = await import('./divisions');
    ideology = await import('../ideology');
    ideologyRepo = await import('../ideology/repository');
    stancesRepo = await import('./repository');
    voting = await import('../voting/service');
    ({ MEANING_SYSTEM_PROMPT, MATCH_PROMPT_VERSION } = await import('./divisionPrompt'));
  }, 60_000);

  beforeEach(async () => {
    await q(
      `truncate politics.division_readings, politics.td_stances, politics.td_ideology_evidence, politics.ideology_profiles,
                politics.division_votes, politics.divisions, politics.debate_sections, politics.policy_votes, politics.policy_questions,
                politics.news_articles, politics.news_sources, politics.tds restart identity cascade`,
    );
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  describe('schema', () => {
    it('a stance is a news quote or a Dáil vote, never both or neither; a reading cannot hold an impossible answer', async () => {
      const td = await addTd('Check Deputy', null);
      const question = await addQuestion('housing', '2026-09-25T09:00:00Z');
      const division = await addDivision('2026-09-24', 1);
      const source = (await q<{ id: number }>("insert into politics.news_sources (slug, name, homepage_url) values ('rte', 'RTÉ', 'https://www.rte.ie') returning id"))[0]!.id;
      const article = (await q<{ id: number }>("insert into politics.news_articles (source_id, url, title, content, published_at) values ($1, 'https://x.ie/1', 't', 'c', now())returning id", [source]))[0]!.id;
      const stance = (over: { article?: number | null; division?: string | null; kind?: string; vote?: string | null; discipline?: string | null; option?: string }) =>
        q(
          `insert into politics.td_stances (td_id, article_id, division_id, division_vote, discipline, question_id, option_key, quote, quote_kind, policy_domain, stated_at, article_url, source_name, headline)
           values ($1, $2, $3, $4, $5, $6, $7, 'q', $8, 'housing', now(), 'u', 's', 'h')`,
          [td, over.article ?? null, over.division ?? null, over.vote ?? null, over.discipline ?? null, question, over.option ?? 'option_a', over.kind ?? 'division'],
        );
      const vote = { division, vote: 'ta', discipline: 'free' };
      await expect(stance({ ...vote, article })).rejects.toThrow(/td_stances_source_chk/);
      await expect(stance({ kind: 'direct' })).rejects.toThrow(/td_stances_source_chk/);
      await expect(stance({ article, kind: 'division' })).rejects.toThrow(/td_stances_division_kind_chk/);
      // 'staon' does not even fit varchar(3); any other value is the CHECK's to refuse.
      await expect(stance({ ...vote, vote: 'staon' })).rejects.toThrow();
      await expect(stance({ ...vote, vote: 'yes' })).rejects.toThrow(/td_stances_division_vote_chk/);
      await expect(stance({ article, kind: 'direct', vote: 'ta' })).rejects.toThrow(/td_stances_division_vote_chk/);
      await expect(stance({ ...vote, discipline: null })).rejects.toThrow(/td_stances_discipline_chk/);
      await expect(stance({ ...vote, option: 'option_z' })).rejects.toThrow(/td_stances_option_fk/);
      await expect(stance(vote)).resolves.toBeDefined();
      await expect(stance({ article, kind: 'direct' })).resolves.toBeDefined();

      const reading = (over: Record<string, unknown>) => {
        const row = { status: 'matched', reject_reason: null, question_id: question, ta_option_key: 'option_a', nil_option_key: 'option_b', quote: 'q', ta_means: 't', ...over };
        return q(
          `insert into politics.division_readings (division_id, status, reject_reason, question_id, ta_option_key, nil_option_key, quote, ta_means, input_hash)
           values ($1, $2, $3, $4, $5, $6, $7, $8, 'h')`,
          [division, row.status, row.reject_reason, row.question_id, row.ta_option_key, row.nil_option_key, row.quote, row.ta_means],
        );
      };
      await expect(reading({ nil_option_key: 'option_a' })).rejects.toThrow(/division_readings_nil_chk/);
      await expect(reading({ status: 'rejected', question_id: null, ta_option_key: null, nil_option_key: null })).rejects.toThrow(/division_readings_reject_reason_chk/);
      await expect(reading({ ta_option_key: 'option_z' })).rejects.toThrow(/division_readings_ta_option_fk/);
      await expect(reading({ quote: null })).rejects.toThrow(/division_readings_quoted_chk/);
      await expect(reading({})).resolves.toBeDefined();
      // A deleted question takes the reading with it, and the division is read again.
      await q('delete from politics.policy_questions where id = $1', [question]);
      expect(await readings()).toEqual([]);
    });
  });

  describe('readings', () => {
    it('stores the reading with its model and tokens; a second run calls nothing; a match is never re-matched without --reclassify', async () => {
      const question = await addQuestion('housing', '2026-09-25T09:00:00Z');
      const d1 = await addDivision('2026-09-24', 1);
      const model = stub();
      const first = await classify(model.complete);
      expect(first).toMatchObject({ pending: 1, read: 1, calls: 2, promptTokens: 200, completionTokens: 40, statuses: { matched: 1 } });
      expect(model.calls).toEqual(['meaning', 'match']);
      expect(await readings()).toEqual([
        expect.objectContaining({
          division_id: d1,
          status: 'matched',
          division_kind: 'motion',
          quote_block: 'M1',
          quote: QUOTE,
          policy_domain: 'housing',
          question_id: question,
          ta_option_key: 'option_a',
          nil_option_key: 'option_b',
          candidate_ids: [question],
          model: 'stub-model',
          prompt_tokens: 200,
          completion_tokens: 40,
          attempts: 0,
          meaning_prompt_version: 1,
          match_prompt_version: MATCH_PROMPT_VERSION,
        }),
      ]);

      // A newer, closer question arrives: a matched division stays on its question.
      await addQuestion('housing', '2026-09-24T09:00:00Z');
      expect((await classify(model.complete)).calls).toBe(0);
      await nightly(model.complete, true, later(2));
      expect(model.calls).toHaveLength(2);

      // --reclassify re-matches it (call 2 only); an old meaning prompt version is read again whole.
      expect(await classify(model.complete, { reclassify: true })).toMatchObject({ calls: 1 });
      await q('update politics.division_readings set meaning_prompt_version = 0');
      expect(await classify(model.complete, { reclassify: true })).toMatchObject({ calls: 2 });
      expect(model.calls).toEqual(['meaning', 'match', 'match', 'meaning', 'match']);
    });

    it('no question in the window: no call at all, and none once the window has closed', async () => {
      await addQuestion('housing', '2026-09-25T09:00:00Z');
      await addDivision('2025-06-10', 1); // more than 60 days before any question
      const model = stub();
      expect(await classify(model.complete)).toMatchObject({ calls: 0, statuses: { no_candidates: 1 } });
      expect(await readings()).toEqual([expect.objectContaining({ status: 'no_candidates', ta_means: null, model: null })]);
      expect(await classify(model.complete)).toMatchObject({ pending: 0, calls: 0 });
      expect(model.calls).toEqual([]);
    });

    it('a question of another domain lets call 1 run; a same-domain question arriving later costs one call 2 and no call 1', async () => {
      await addQuestion('economy', '2026-09-25T09:00:00Z');
      await addDivision('2026-09-24', 1);
      const model = stub();
      expect(await classify(model.complete)).toMatchObject({ calls: 1, statuses: { no_candidates: 1 } });
      expect(await readings()).toEqual([expect.objectContaining({ status: 'no_candidates', ta_means: 'Build public homes.', quote: QUOTE, candidate_ids: [] })]);
      expect((await classify(model.complete)).calls).toBe(0);

      const housing = await addQuestion('housing', '2026-09-26T09:00:00Z');
      expect(await classify(model.complete)).toMatchObject({ calls: 1, statuses: { matched: 1 } });
      expect(model.calls).toEqual(['meaning', 'match']);
      expect((await readings())[0]).toMatchObject({ question_id: housing });
    });

    it('a no-match is checked again at most once a week, and only when its candidate set changed', async () => {
      const q1 = await addQuestion('housing', '2026-09-25T09:00:00Z');
      await addDivision('2026-09-24', 1);
      const model = stub({ match: () => ({ question_id: null, confidence: 0.9 }) });
      expect(await classify(model.complete)).toMatchObject({ calls: 2, statuses: { no_match: 1 } });
      expect((await readings())[0]).toMatchObject({ status: 'no_match', candidate_ids: [q1] });

      // Same set, a week on: no call.
      expect((await classify(model.complete, { now: later(8) })).calls).toBe(0);
      // A different set of the same size (q1 gone, q2 in): one call 2, no call 1.
      await q('delete from politics.policy_questions where id = $1', [q1]);
      const q2 = await addQuestion('housing', '2026-09-26T09:00:00Z');
      expect((await classify(model.complete, { now: later(8) })).calls).toBe(1);
      expect((await readings())[0]).toMatchObject({ candidate_ids: [q2] });
      // Changed again, but within the week: no call; after it: one.
      await addQuestion('housing', '2026-09-27T09:00:00Z');
      expect((await classify(model.complete, { now: later(10) })).calls).toBe(0);
      expect((await classify(model.complete, { now: later(16) })).calls).toBe(1);
      expect(model.calls).toEqual(['meaning', 'match', 'match', 'match']);
    });

    it('waits 14 days for a debate record, and makes no call on fewer than 8 words of proposal', async () => {
      await addQuestion('housing', '2026-09-25T09:00:00Z');
      await addDivision('2026-09-28', 1, { motion: null });
      const model = stub();
      expect(await classify(model.complete)).toMatchObject({ calls: 0, statuses: { no_context: 1 } });
      // Old enough: read on what exists, which is only "Question put": no call.
      expect(await classify(model.complete, { now: later(12) })).toMatchObject({ calls: 0, statuses: { rejected: 1 } });
      expect(await readings()).toEqual([expect.objectContaining({ status: 'rejected', reject_reason: 'quote_not_found', model: null })]);
      expect(model.calls).toEqual([]);
    });

    it('a failed call or unusable output is failed, and retried until three in a row have failed', async () => {
      await addQuestion('housing', '2026-09-25T09:00:00Z');
      await addDivision('2026-09-24', 1);
      const bad = stub({ meaning: () => 'not json' });
      for (let i = 0; i < 4; i++) await classify(bad.complete);
      expect(bad.calls).toEqual(['meaning', 'meaning', 'meaning']);
      expect(await readings()).toEqual([expect.objectContaining({ status: 'failed', attempts: 3, model: 'stub-model' })]);

      await addDivision('2026-09-23', 2);
      const down: DivisionCompletion = async () => {
        throw new Error('provider down');
      };
      const s = await classify(down);
      expect(s).toMatchObject({ calls: 1, statuses: { failed: 1 } });
      expect(s.readings[0]).toMatchObject({ divisionId: 'dail-34-2026-09-23-vote_2', status: 'failed', error: 'provider down' });
    });

    it('a rejected meaning makes no call 2', async () => {
      await addQuestion('housing', '2026-09-25T09:00:00Z');
      await addDivision('2026-09-24', 1);
      const model = stub({ meaning: () => ({ ...(meaningReply('') as object), division_kind: 'as_amended' }) });
      expect(await classify(model.complete)).toMatchObject({ calls: 1, statuses: { rejected: 1 } });
      expect((await readings())[0]).toMatchObject({ reject_reason: 'ambiguous', quote: null });
    });

    it('--dry-run writes nothing; reading writes no stance and no evidence; a limit reads the newest first', async () => {
      await seedLobbies();
      await addDivision('2026-09-22', 2);
      await addDivision('2026-09-23', 3);
      const model = stub();
      const dry = await classify(model.complete, { dryRun: true, limit: 2 });
      expect(dry).toMatchObject({ read: 2, calls: 4 });
      expect(dry.readings.map((r) => r.divisionId)).toEqual(['dail-34-2026-09-24-vote_1', 'dail-34-2026-09-23-vote_3']);
      expect(dry.readings[0]).toMatchObject({ status: 'matched', blocks: ['Q', 'M1'], quoteBlock: 'M1', match: { ta: 'Build public homes', nil: 'Leave it to the market' } });
      expect(await readings()).toEqual([]);

      await classify(model.complete);
      expect(await readings()).toHaveLength(3);
      expect(await stances()).toEqual([]);
      expect(await evidence()).toEqual([]);
    });
  });

  describe('the sync', () => {
    it('every vote on a matched side is a stance with its discipline; only free and rebel votes are evidence', async () => {
      const { peers, rebel, independent, rdr, green, d1 } = await seedLobbies();
      await classify(stub().complete);
      const summary = await divisions.syncDivisionStances(NOW);
      expect(summary).toMatchObject({ divisions: 1, rows: 9, skipped: 0, evidence: 3 });

      const rows = await stances();
      const by = new Map(rows.map((r) => [r.td_id, [r.division_vote, r.option_key, r.discipline]]));
      for (const id of peers) expect(by.get(id)).toEqual(['ta', 'option_a', 'whip']);
      expect(by.get(green)).toEqual(['ta', 'option_a', 'whip']);
      expect(by.get(rebel)).toEqual(['nil', 'option_b', 'rebel']);
      expect(by.get(independent)).toEqual(['nil', 'option_b', 'free']);
      expect(by.get(rdr)).toEqual(['ta', 'option_a', 'free']);
      expect(rows.every((r) => r.division_id === d1 && r.quote_kind === 'division')).toBe(true);

      expect((await evidence()).map((r) => [r.td_id, r.economic, Math.round(r.weight * 100) / 100])).toEqual([
        [rebel, 10, 0.9],
        [independent, 10, 0.6],
        [rdr, -10, 0.6],
      ]);
    });

    it('replaces the rows on each sync; a deleted division takes its reading, rows and evidence; a re-match moves the slot', async () => {
      const { rebel, d1, question } = await seedLobbies();
      await classify(stub().complete);
      await divisions.syncDivisionStances(NOW);
      await q("update politics.division_votes set vote = 'ta' where td_id = $1", [rebel]);
      await divisions.syncDivisionStances(NOW);
      expect((await stances()).find((r) => r.td_id === rebel)).toMatchObject({ division_vote: 'ta', discipline: 'whip' });
      expect((await evidence()).map((r) => r.td_id)).not.toContain(rebel);
      expect(await stances()).toHaveLength(9);

      const other = await addQuestion('housing', '2026-09-24T12:00:00Z'); // nearer the vote: first candidate
      await classify(stub().complete, { reclassify: true });
      await divisions.syncDivisionStances(NOW);
      expect(new Set((await evidence()).map((r) => r.source_ref))).toEqual(new Set([`question:${other}`]));
      expect((await stances()).every((r) => r.option_key !== null)).toBe(true);
      expect(question).not.toBe(other);

      await q('delete from politics.divisions where id = $1', [d1]);
      expect(await readings()).toEqual([]);
      expect(await stances()).toEqual([]);
      await divisions.syncDivisionStances(NOW);
      expect(await evidence()).toEqual([]);
    });

    it('news evidence is unchanged by the rebuild: the same rows record.ts wrote', async () => {
      const { recordStances, emptyStanceStats } = await import('./record');
      const { questionForArticle } = await import('../voting');
      const source = (await q<{ id: number }>("insert into politics.news_sources (slug, name, homepage_url) values ('rte', 'RTÉ News', 'https://www.rte.ie') returning id"))[0]!.id;
      const say = 'We will build fifty thousand public homes every year until the crisis is over.';
      const speak = 'the State must build more social homes on public land without any more delay';
      const content = `Mary Lou McDonald said: "${say}" Separately, Ruairí Ó Murchú said ${speak}. `.repeat(4);
      const article = (await q<{ id: number }>('insert into politics.news_articles (source_id, url, title, content, published_at) values ($1, $2, $3, $4, $5) returning id', [source, 'https://x.ie/a', 'Housing', content, '2026-09-26T09:00:00Z']))[0]!.id;
      const [question] = await q<{ id: number }>(
        "insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline) values ($1, 'Housing?', 'housing', 'public_housing_targets', 'h') returning id",
        [article],
      );
      await q(
        `insert into politics.policy_question_options (question_id, option_key, label, position, economic, welfare, weight, confidence) values
         ($1, 'option_a', 'Build public homes', 0, -2, -1, 1.5, 0.8), ($1, 'option_b', 'Leave it to the market', 1, 2, 0, 1, null)`,
        [question!.id],
      );
      const mary = await addTd('Mary Lou McDonald', 'Sinn Féin');
      const ruairi = await addTd('Ruairí Ó Murchú', 'Sinn Féin');
      const replies: Record<string, unknown> = {
        tdStances: {
          stances: [
            { td_id: mary, policy_domain: 'housing', quote: say, quote_kind: 'direct' },
            { td_id: ruairi, policy_domain: 'housing', quote: speak, quote_kind: 'paraphrase' },
          ],
        },
        stanceOptions: { matches: [{ index: 0, option_key: 'option_a' }, { index: 1, option_key: 'option_a' }] },
      };
      const candidates = [mary, ruairi].map((id, i) => ({ id, name: ['Mary Lou McDonald', 'Ruairí Ó Murchú'][i]!, party: 'Sinn Féin', offices: [] }));
      await recordStances({ id: article, title: 'Housing', content }, candidates, emptyStanceStats(), {
        complete: async (_s, _u, _t, operation) => replies[operation],
        position: async () => 0.9,
        question: () => questionForArticle(article),
      });
      const written = await evidence();
      expect(written.map((r) => [r.td_id, Math.round(r.weight * 1000) / 1000])).toEqual([
        [mary, 1.2],
        [ruairi, 0.72],
      ]);
      await divisions.syncDivisionStances(NOW);
      expect(await evidence()).toEqual(written.map((r) => ({ ...r, id: expect.any(Number), created_at: expect.any(Date) })));
    });

    it('the latest stance wins, in items and in evidence: a newer quote over an older vote, a newer free vote over an older quote', async () => {
      const { castVote } = voting;
      const question = await addQuestion('housing', '2026-09-25T09:00:00Z');
      const td = await addTd('Ind Voter', 'Independent');
      const source = (await q<{ id: number }>("insert into politics.news_sources (slug, name, homepage_url) values ('rte', 'RTÉ News', 'https://www.rte.ie') returning id"))[0]!.id;
      const quoteOn = async (statedAt: string) => {
        const article = (await q<{ id: number }>("insert into politics.news_articles (source_id, url, title, content, published_at) values ($1, $2, 't', 'c', now()) returning id", [source, `https://x.ie/${statedAt}`]))[0]!.id;
        await q(
          `insert into politics.td_stances (td_id, article_id, question_id, option_key, option_text, quote, quote_kind, policy_domain, stated_at, article_url, source_name, headline)
           values ($1, $2, $3, 'option_b', 'Leave it to the market', 'q', 'direct', 'housing', $4, 'u', 'RTÉ News', 'h')`,
          [td, article, question, statedAt],
        );
      };
      const d1 = await addDivision('2026-09-20', 1);
      await vote(d1, td, 'ta'); // free: option_a, held at noon on 09-20
      await classify(stub().complete);
      await castVote({ userId: 'user-c', questionId: question, optionKey: 'option_a', source: 'article' });
      // The user's vote is cast now (the real clock), so their matches are read now too.
      const item = async () => (await ideology.userMatches('user-c', {}, { tdId: td }))!.tds.find((t) => t.tdId === td)!.issues!.items[0]!;

      await quoteOn('2026-09-25T09:00:00Z'); // newer quote: option_b
      await divisions.syncDivisionStances(NOW);
      expect((await evidence()).map((r) => r.economic)).toEqual([10]);
      expect(await item()).toMatchObject({ quoteKind: 'direct', theirs: 'Leave it to the market', divisionVote: null });

      await q('delete from politics.td_stances where article_id is not null');
      await quoteOn('2026-09-15T09:00:00Z'); // older quote: the free vote wins
      await divisions.syncDivisionStances(NOW);
      expect((await evidence()).map((r) => r.economic)).toEqual([-10]);
      expect(await item()).toMatchObject({ quoteKind: 'division', theirs: 'Build public homes', divisionVote: 'ta', outlet: 'Dáil Éireann', url: 'https://www.oireachtas.ie/en/debates/vote/dail/34/2026-09-20/1/' });
    });

    it('the evidence insert keeps the newer row when the slot already exists, and never throws', async () => {
      const td = await addTd('Slot Deputy', 'Independent');
      const row = (economic: number, observedAt: string) => ({ tdId: td, source: 'stance', sourceRef: 'question:9', economic, weight: 1, observedAt: new Date(observedAt) });
      await ideologyRepo.insertStanceEvidenceRows(dbmod.db, [row(5, '2026-09-20T00:00:00Z')]);
      await ideologyRepo.insertStanceEvidenceRows(dbmod.db, [row(-5, '2026-09-22T00:00:00Z')]);
      expect((await evidence()).map((r) => r.economic)).toEqual([-5]);
      await ideologyRepo.insertStanceEvidenceRows(dbmod.db, [row(9, '2026-09-21T00:00:00Z')]);
      expect((await evidence()).map((r) => r.economic)).toEqual([-5]);
    });

    it('waits for another process holding the stance sync lock', async () => {
      await seedLobbies();
      await classify(stub().complete);
      const other = new pkg.Client({ connectionString: divisionsUrl });
      await other.connect();
      try {
        await other.query('select pg_advisory_lock($1::bigint)', [ideologyRepo.STANCE_SYNC_LOCK]);
        let done = false;
        let evidenceDone = false;
        // Both whole-set writes take the lock: the vote stances, and the evidence rebuild.
        const sync = divisions.syncDivisionStances(NOW).then(() => {
          done = true;
        });
        const rebuild = ideologyRepo.replaceStanceEvidence([]).then(() => {
          evidenceDone = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect([done, evidenceDone]).toEqual([false, false]);
        expect(await stances()).toEqual([]);
        await other.query('select pg_advisory_unlock($1::bigint)', [ideologyRepo.STANCE_SYNC_LOCK]);
        await Promise.all([sync, rebuild]);
        expect(await stances()).toHaveLength(9);
      } finally {
        await other.end();
      }
    });

    it('recomputes from the committed rows: a full rebuild afterwards changes no TD profile', async () => {
      await seedLobbies();
      await classify(stub().complete);
      await divisions.syncDivisionStances(); // the real clock, as recalculateAll uses: decay depends on it
      const key = (p: { subjectId: string } & Record<string, unknown>) => `${p.subjectId}:${['economic', 'welfare'].map((d) => p[d]).join(',')}`;
      const before = (await ideologyRepo.listProfiles('td')).map(key).sort();
      expect(before).toHaveLength(9);
      await ideology.recalculateAll();
      expect((await ideologyRepo.listProfiles('td')).map(key).sort()).toEqual(before);
    });

    it('the TD page and a user’s matches show the vote: the option, Tá or Níl, the oireachtas.ie link', async () => {
      const { stancesRouter } = await import('./routes');
      const { independent, question, d1 } = await seedLobbies();
      await classify(stub().complete);
      await divisions.syncDivisionStances(NOW);
      const app = express();
      app.use('/api/stances', stancesRouter);
      const server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      try {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const body = (await (await fetch(`http://127.0.0.1:${port}/api/stances/td/${independent}`, { headers: { connection: 'close' } })).json()) as {
          data: import('@shared/stancesApi').TdStances;
        };
        expect(body.data.domains[0]!.stances[0]).toMatchObject({ quoteKind: 'division', divisionVote: 'nil', optionText: 'Leave it to the market', quote: QUOTE, outlet: 'Dáil Éireann', saidCount: 1, changedPosition: false });
      } finally {
        server.closeAllConnections?.();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      await voting.castVote({ userId: 'user-m', questionId: question, optionKey: 'option_b', source: 'article' });
      const td = (await ideology.userMatches('user-m', {}, { tdId: independent }))!.tds.find((t) => t.tdId === independent)!;
      expect(td.issues!.items[0]).toMatchObject({ theirs: 'Leave it to the market', agrees: true, quoteKind: 'division', divisionVote: 'nil', url: `https://www.oireachtas.ie/en/debates/vote/dail/34/2026-09-24/1/` });
      expect(d1).toBe('dail-34-2026-09-24-vote_1');
    });
  });

  describe('the nightly run', () => {
    it('makes at most NIGHTLY_LIMIT model calls, then syncs, and logs one line', async () => {
      await addQuestion('housing', '2026-09-25T09:00:00Z');
      const td = await addTd('Ind Voter', 'Independent');
      for (let k = 1; k <= 12; k++) await vote(await addDivision('2026-09-24', k), td, 'ta');
      const model = stub();
      const lines: string[] = [];
      const result = await divisions.runDivisionStances({ mode: 'nightly', complete: model.complete, llmConfigured: true, now: NOW, log: (l) => lines.push(l) });
      expect(model.calls).toHaveLength(divisions.NIGHTLY_LIMIT);
      expect(result.classify).toMatchObject({ pending: 12, read: 10, calls: 20 });
      expect(result.sync.rows).toBe(10);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^\[division-stances\] .*20 model call\(s\), 2000 prompt \+ 400 completion tokens/);
    });

    it('with no LLM configured it reads nothing and still syncs', async () => {
      await seedLobbies();
      await classify(stub().complete);
      const model = stub();
      const result = await nightly(model.complete, false);
      expect(model.calls).toEqual([]);
      expect(result.classify).toBeNull();
      expect(await stances()).toHaveLength(9);
    });

    it('refuses a second run while one is in flight', async () => {
      await addQuestion('housing', '2026-09-25T09:00:00Z');
      await addDivision('2026-09-24', 1);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const slow = stub();
      const held: DivisionCompletion = async (system, user) => {
        await gate;
        return slow.complete(system, user);
      };
      const first = nightly(held);
      await expect(nightly(held)).rejects.toBeInstanceOf(divisions.DivisionStancesAlreadyRunning);
      release();
      await first;
      await expect(nightly(held)).resolves.toBeDefined();
    });
  });

  describe('an answer that says more than the vote', () => {
    it('is no match when it names a figure the proposal does not, and the reading keeps why', async () => {
      const question = await addQuestion('housing', '2026-09-25T09:00:00Z');
      // The vote's words and meaning name no figure; this answer names one.
      await q("update politics.policy_question_options set label = 'Build 100,000 public homes a year' where question_id = $1 and option_key = 'option_a'", [question]);
      const d1 = await addDivision('2026-09-24', 1);
      const model = stub();
      expect(await classify(model.complete)).toMatchObject({ calls: 2, statuses: { no_match: 1, matched: 0 } });
      expect(model.calls).toEqual(['meaning', 'match']);
      const [reading] = await readings();
      expect(reading).toMatchObject({ division_id: d1, status: 'no_match', question_id: null, ta_option_key: null });
      expect(reading.match_reason).toMatch(/^Refused: the answer names 100000, which the proposal does not\. Model said: stated/);
      // Nothing to publish from it.
      expect((await divisions.syncDivisionStances(NOW)).rows).toBe(0);
    });

    it('still matches when the answer names no figure', async () => {
      await addQuestion('housing', '2026-09-25T09:00:00Z');
      await addDivision('2026-09-24', 1);
      expect(await classify(stub().complete)).toMatchObject({ statuses: { matched: 1 } });
    });
  });

  describe('the audit', () => {
    const zero = { economic: 0, social: 0, cultural: 0, authority: 0, environmental: 0, welfare: 0, globalism: 0, technocratic: 0 };
    const votesOf = (divisionId: string) => [
      { divisionId, party: 'Sinn Féin', vote: 'ta' as const },
      { divisionId, party: 'Sinn Féin', vote: 'ta' as const },
      { divisionId, party: 'Fine Gael', vote: 'nil' as const },
      { divisionId, party: 'Independent', vote: 'nil' as const }, // no baseline: left out of the lobby means
    ];

    it("counts how often the Tá − Níl options point the way the lobbies' party baselines do", () => {
      // SF economic −6, FG +1.5: the Tá lobby is 7.5 to the left. Welfare −7 vs +0.5.
      const audit = divisions.auditDivisions(
        [
          { divisionId: 'agrees', taMeans: null, taVector: { ...zero, economic: -2, welfare: -1 }, nilVector: { ...zero, economic: 2 } },
          { divisionId: 'disagrees', taMeans: 'x', taVector: { ...zero, economic: 2, welfare: 1 }, nilVector: { ...zero, economic: -2, welfare: -1 } },
          { divisionId: 'weak', taMeans: null, taVector: { ...zero, economic: 0.4 }, nilVector: null }, // under AUDIT_MIN_LEAN: not counted
        ],
        [...votesOf('agrees'), ...votesOf('disagrees'), ...votesOf('weak')],
      );
      expect(audit.byDimension.economic).toEqual({ agree: 1, total: 2 });
      expect(audit.byDimension.welfare).toEqual({ agree: 1, total: 2 });
      expect(audit.byDimension.social).toEqual({ agree: 0, total: 0 });
      expect(audit).toMatchObject({ divisions: 2, agree: 2, total: 4 });
      expect(audit.worst.map((w) => [w.divisionId, w.disagreements.map((d) => d.dimension)])).toEqual([['disagrees', ['economic', 'welfare']]]);
    });

    it('counts an unscored dimension but leaves it out of the score and the disagreements', () => {
      // SF technocratic 0, FG −4: the Tá lobby is 4 more populist. An expert-led Tá option "disagrees" there, and is not held against the match.
      const audit = divisions.auditDivisions(
        [{ divisionId: 'gov-vs-opposition', taMeans: null, taVector: { ...zero, economic: -2, technocratic: -1 }, nilVector: { ...zero, economic: 2 } }],
        votesOf('gov-vs-opposition'),
      );
      expect(audit.byDimension.technocratic).toEqual({ agree: 0, total: 1 });
      expect(audit.byDimension.economic).toEqual({ agree: 1, total: 1 });
      expect(audit).toMatchObject({ divisions: 1, agree: 1, total: 1, worst: [] });
    });

    it('lists every matched division for review, with its question, options and link', async () => {
      await seedLobbies();
      await classify(stub().complete);
      const { matched, audit } = await divisions.runDivisionAudit();
      expect(matched).toEqual([
        expect.objectContaining({ divisionId: 'dail-34-2026-09-24-vote_1', quote: QUOTE, ta: 'Build public homes', nil: 'Leave it to the market', url: 'https://www.oireachtas.ie/en/debates/vote/dail/34/2026-09-24/1/' }),
      ]);
      // Both lobbies here are mostly Sinn Féin, so no axis's baselines differ by AUDIT_MIN_GAP: nothing to score.
      expect(audit).toMatchObject({ divisions: 0, total: 0 });
    });
  });
});

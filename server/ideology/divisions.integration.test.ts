/**
 * Dáil divisions as TD evidence, against a real Postgres: the reading cache, retries, the
 * nightly run and its guard, the evidence sync (replace, lock, recompute) and the audit.
 * Every model call is a stub; nothing here reaches a model.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_divisions`.
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/ideology/divisions.integration.test.ts
 */
import pkg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';
import type { DivisionCompletion } from './divisions';

const divisionsUrl = testDatabaseUrl('divisions');
const run = describe.skipIf(!divisionsUrl);

if (divisionsUrl) {
  process.env.DATABASE_URL = divisionsUrl;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const NOW = new Date('2026-10-01T12:00:00Z');
const LEFT = { economic: -2, welfare: -2, social: -1, environmental: -1 };
const RIGHT = { economic: 2, welfare: 2, social: 1, environmental: 1 };

/** A model answer; `over` replaces fields. */
const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    ta_means: 'For the amendment',
    division_kind: 'amendment',
    procedural: false,
    free_vote: false,
    policy_topic: 'housing',
    ta_lean: LEFT,
    nil_lean: RIGHT,
    nil_weight: 1,
    salience: 1,
    confidence: 1,
    reasoning: 'stub',
    ...over,
  });

/** A stub model: `content` per user prompt. Records every prompt it was asked. */
function stub(content: (user: string) => string | null = () => answer()) {
  const prompts: string[] = [];
  const complete: DivisionCompletion = async (_system, user) => {
    prompts.push(user);
    return { content: content(user), model: 'stub-model', promptTokens: 100, completionTokens: 20 };
  };
  return { complete, prompts };
}

run('division ideology against Postgres', { timeout: 60_000 }, () => {
  let dbmod: typeof import('../db');
  let divisions: typeof import('./divisions');
  let ideology: typeof import('./index');
  let repo: typeof import('./repository');
  let partyBaseline: typeof import('./partyBaselines').partyBaseline;
  let PROMPT_VERSION: number;

  const q = <T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    dbmod.pool.query<T>(text, params).then((r) => r.rows);

  async function addTd(name: string, party: string | null, active = true): Promise<number> {
    const [row] = await q<{ id: number }>('insert into politics.tds (name, party, is_active) values ($1, $2, $3) returning id', [name, party, active]);
    return row!.id;
  }

  async function addDivision(id: string, date: string, subject = 'Amendment put', section: string | null = null): Promise<void> {
    await q(
      `insert into politics.divisions (id, uri, house_no, date, subject, debate_section_id, ta_count, nil_count, staon_count)
       values ($1, $2, 34, $3, $4, $5, 10, 10, 0)`,
      [id, `test:${id}`, date, subject, section],
    );
  }

  async function vote(divisionId: string, tdId: number, how: 'ta' | 'nil' | 'staon'): Promise<void> {
    await q('insert into politics.division_votes (division_id, member_code, td_id, vote) values ($1, $2, $3, $4)', [divisionId, `member-${tdId}`, tdId, how]);
  }

  const readings = () => q('select * from politics.division_ideology order by division_id');
  const evidence = () =>
    q<{ td_id: number; source: string; source_ref: string; weight: number; economic: number | null; observed_at: Date }>(
      'select * from politics.td_ideology_evidence order by td_id, source_ref',
    );
  const nightly = (complete: DivisionCompletion, llmConfigured = true) =>
    divisions.runDivisionIdeology({ mode: 'nightly', complete, llmConfigured, now: NOW, log: () => {} });

  /** One division d1 (left Tá, right Níl): Sinn Féin 5 Tá + 1 Níl, an Independent Níl, '100% RDR' Tá, a Green Níl. */
  async function seedLobbies() {
    const peers = [];
    for (let i = 1; i <= 5; i++) peers.push(await addTd(`SF Peer ${i}`, 'Sinn Féin'));
    const rebel = await addTd('SF Rebel', 'Sinn Féin');
    const independent = await addTd('Ind Voter', 'Independent');
    const rdr = await addTd('RDR Voter', '100% RDR');
    const green = await addTd('Green Voter', 'Green Party');
    const retired = await addTd('Retired Independent', 'Independent', false);
    await addDivision('d1', '2025-06-10');
    for (const id of peers) await vote('d1', id, 'ta');
    await vote('d1', rebel, 'nil');
    await vote('d1', independent, 'nil');
    await vote('d1', rdr, 'ta');
    await vote('d1', green, 'nil');
    await vote('d1', retired, 'ta');
    return { peers, rebel, independent, rdr, green, retired };
  }

  beforeAll(async () => {
    await ensureDatabase(divisionsUrl!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    divisions = await import('./divisions');
    ideology = await import('./index');
    repo = await import('./repository');
    partyBaseline = (await import('./partyBaselines')).partyBaseline;
    PROMPT_VERSION = (await import('./divisionPrompt')).DIVISION_PROMPT_VERSION;
  }, 60_000);

  beforeEach(async () => {
    await q('truncate politics.division_ideology, politics.td_ideology_evidence, politics.ideology_profiles, politics.division_votes, politics.divisions, politics.tds restart identity cascade');
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  describe('readings', () => {
    it('stores each reading with its model and tokens, and reuses it until the prompt or the record changes', async () => {
      await addDivision('d1', '2025-06-10');
      await addDivision('d2', '2025-06-11');
      const model = stub();
      const first = await divisions.classifyDivisions({ complete: model.complete, now: NOW });
      expect(first).toMatchObject({ pending: 2, read: 2, calls: 2, promptTokens: 200, completionTokens: 40, statuses: { classified: 2 } });
      const rows = await readings();
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row).toMatchObject({ status: 'classified', model: 'stub-model', prompt_tokens: 100, completion_tokens: 20, attempts: 1, prompt_version: PROMPT_VERSION, ta_lean: LEFT, nil_lean: RIGHT, confidence: 1, ta_means: 'For the amendment' });
        expect(row.input_hash).toMatch(/^[0-9a-f]{16}$/);
      }

      // Cached: a second run, and the nightly run, call nothing.
      expect((await divisions.classifyDivisions({ complete: model.complete, now: NOW })).calls).toBe(0);
      expect(model.prompts).toHaveLength(2);

      // An old prompt version and a corrected record: the nightly run never re-reads them…
      await q("update politics.division_ideology set prompt_version = 0 where division_id = 'd1'");
      await q("update politics.divisions set subject = 'Motion re housing' where id = 'd2'");
      await nightly(model.complete);
      expect(model.prompts).toHaveLength(2);
      expect((await divisions.classifyDivisions({ complete: model.complete, now: NOW })).calls).toBe(0);

      // …--reclassify does, both.
      const again = await divisions.classifyDivisions({ complete: model.complete, now: NOW, reclassify: true });
      expect(again).toMatchObject({ read: 2, calls: 2 });
      expect((await readings()).map((r) => r.prompt_version)).toEqual([PROMPT_VERSION, PROMPT_VERSION]);
      expect(model.prompts.slice(2).join('\n')).toContain('Motion re housing');
    });

    it('waits for the debate record for 14 days, then reads the division on its metadata alone', async () => {
      await addDivision('fresh', '2026-09-25');
      const model = stub();
      const early = await divisions.classifyDivisions({ complete: model.complete, now: NOW });
      expect(early).toMatchObject({ calls: 0, statuses: { no_context: 1 } });
      expect(await readings()).toEqual([expect.objectContaining({ division_id: 'fresh', status: 'no_context', attempts: 0, model: null })]);
      // Retried on the next run; still too early.
      expect((await divisions.classifyDivisions({ complete: model.complete, now: NOW })).calls).toBe(0);
      const later = await divisions.classifyDivisions({ complete: model.complete, now: new Date('2026-10-10T12:00:00Z') });
      expect(later).toMatchObject({ calls: 1, statuses: { classified: 1 } });
      expect(model.prompts[0]).toContain('No debate record is available');
    });

    it('marks a procedural or empty reading no_signal and does not retry it', async () => {
      await addDivision('adj', '2025-06-10', 'Adjournment');
      await addDivision('zero', '2025-06-11', 'Nothing');
      const model = stub((user) => (user.includes('Adjournment') ? answer({ procedural: true }) : answer({ ta_lean: { economic: 0 }, nil_lean: { economic: 0 } })));
      expect(await divisions.classifyDivisions({ complete: model.complete, now: NOW })).toMatchObject({ calls: 2, statuses: { no_signal: 2 } });
      expect((await divisions.classifyDivisions({ complete: model.complete, now: NOW })).calls).toBe(0);
    });

    it('marks bad output and a failed call failed, and retries a reading at most three times', async () => {
      await addDivision('d1', '2025-06-10');
      const bad = stub(() => 'not json');
      for (let run = 0; run < 4; run++) await divisions.classifyDivisions({ complete: bad.complete, now: NOW });
      expect(bad.prompts).toHaveLength(3);
      expect(await readings()).toEqual([expect.objectContaining({ status: 'failed', attempts: 3, model: 'stub-model', ta_lean: null })]);

      await addDivision('d2', '2025-06-11');
      const down: DivisionCompletion = async () => {
        throw new Error('provider down');
      };
      const summary = await divisions.classifyDivisions({ complete: down, now: NOW });
      expect(summary).toMatchObject({ calls: 1, statuses: { failed: 1 } });
      expect(summary.readings[0]).toMatchObject({ divisionId: 'd2', status: 'failed', error: 'provider down' });
      expect((await readings()).find((r) => r.division_id === 'd2')).toMatchObject({ status: 'failed', attempts: 1, model: null });
    });

    it('--dry-run writes nothing, and reading divisions writes no evidence', async () => {
      await seedLobbies();
      const model = stub();
      const dry = await divisions.classifyDivisions({ complete: model.complete, now: NOW, dryRun: true });
      expect(dry).toMatchObject({ calls: 1, statuses: { classified: 1 } });
      expect(dry.readings[0]).toMatchObject({ divisionId: 'd1', subject: 'Amendment put', status: 'classified', model: 'stub-model' });
      expect(dry.readings[0]!.classification?.taLean).toEqual(LEFT);
      expect(await readings()).toEqual([]);

      await divisions.classifyDivisions({ complete: model.complete, now: NOW });
      expect(await readings()).toHaveLength(1);
      expect(await evidence()).toEqual([]);
    });

    it('a limit reads the newest divisions first', async () => {
      for (let day = 10; day <= 13; day++) await addDivision(`d${day}`, `2025-06-${day}`);
      const s = await divisions.classifyDivisions({ complete: stub().complete, now: NOW, limit: 2 });
      expect(s).toMatchObject({ pending: 4, read: 2 });
      expect((await readings()).map((r) => r.division_id)).toEqual(['d12', 'd13']);
    });
  });

  describe('evidence', () => {
    it('gives a row only for votes that were the TD’s own: the Independent, the rebel, the party with no baseline', async () => {
      const { peers, rebel, independent, rdr } = await seedLobbies();
      // Confidence 0.6 keeps every weight under the section cap, so the discipline weights show.
      await divisions.classifyDivisions({ complete: stub(() => answer({ confidence: 0.6 })).complete, now: NOW });
      const summary = await divisions.syncDivisionEvidence(NOW);
      expect(summary).toMatchObject({ divisions: 1, rows: 3 });

      const rows = await evidence();
      expect(rows.map((r) => [r.td_id, Math.round(r.weight * 1000) / 1000])).toEqual([
        [rebel, 0.9], // rebel, 1.5 × 0.6: Níl against the party's Tá
        [independent, 0.6], // free, 1 × 0.6: no prior
        [rdr, 0.6], // free: a party with no baseline
      ]);
      expect(rows.every((r) => r.source === 'division' && r.source_ref === 'd1')).toBe(true);
      expect(rows.map((r) => r.economic)).toEqual([10, 10, -10]); // Níl reads the Níl lobby, Tá the Tá lobby
      expect(rows[0]!.observed_at).toEqual(new Date('2025-06-10T12:00:00Z'));

      const baseline = partyBaseline('Sinn Féin')!;
      const rounded = Object.fromEntries(Object.entries(baseline).map(([d, x]) => [d, Math.round(x * 100) / 100]));
      for (const id of peers) expect((await ideology.tdProfile(id))!.profile!.vector).toEqual(rounded);
      // The rebel's Níl (economic +10) pulls them right of the party line.
      expect((await ideology.tdProfile(rebel))!.profile!.vector.economic).toBeGreaterThan(baseline.economic + 0.5);
    });

    it('replaces the rows on each sync, and a deleted division takes its reading with it', async () => {
      const { rebel } = await seedLobbies();
      await divisions.classifyDivisions({ complete: stub().complete, now: NOW });
      await divisions.syncDivisionEvidence(NOW);
      expect((await evidence()).map((r) => r.td_id)).toContain(rebel);

      await q("update politics.division_votes set vote = 'ta' where td_id = $1", [rebel]);
      await divisions.syncDivisionEvidence(NOW);
      const rows = await evidence();
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.td_id)).not.toContain(rebel);

      await q("delete from politics.divisions where id = 'd1'");
      expect(await readings()).toEqual([]);
      await divisions.syncDivisionEvidence(NOW);
      expect(await evidence()).toEqual([]);
    });

    it("caps a TD's division weight per debate section and in total before writing", async () => {
      const independent = await addTd('Ind Voter', 'Independent');
      // Three free votes (weight 1 each) in one debate.
      for (const k of [1, 2, 3]) {
        await addDivision(`same${k}`, `2025-06-1${k}`, 'Amendment put', 'dail-2025-06-25-dbsect_19');
        await vote(`same${k}`, independent, 'ta');
      }
      // Eight more debates, one vote each: 1 + 8 = 9 > DIVISION_TOTAL_CAP (6).
      for (let k = 0; k < 8; k++) {
        await addDivision(`other${k}`, `2025-05-0${k + 1}`, 'Motion', `dail-2025-05-0${k + 1}-dbsect_1`);
        await vote(`other${k}`, independent, 'ta');
      }
      await divisions.classifyDivisions({ complete: stub().complete, now: NOW });
      await divisions.syncDivisionEvidence(NOW);
      const weightOf = new Map((await evidence()).map((r) => [r.source_ref, Math.round(r.weight * 1000) / 1000]));
      expect(weightOf.size).toBe(11);
      // Section: 3 → 1 (1/3 each). Total: 9 → 6 (× 2/3).
      for (const k of [1, 2, 3]) expect(weightOf.get(`same${k}`)).toBe(0.222);
      for (let k = 0; k < 8; k++) expect(weightOf.get(`other${k}`)).toBe(0.667);
    });

    it('a salience-0 division gives no row, and the others are still written', async () => {
      const independent = await addTd('Ind Voter', 'Independent');
      await addDivision('quiet', '2025-06-10', 'Quiet');
      await addDivision('loud', '2025-06-11', 'Loud');
      await vote('quiet', independent, 'ta');
      await vote('loud', independent, 'ta');
      await divisions.classifyDivisions({ complete: stub((user) => answer({ salience: user.includes('Quiet') ? 0 : 1 })).complete, now: NOW });
      await divisions.syncDivisionEvidence(NOW);
      expect((await evidence()).map((r) => r.source_ref)).toEqual(['loud']);
    });

    it('waits for another process holding the evidence lock', async () => {
      await seedLobbies();
      await divisions.classifyDivisions({ complete: stub().complete, now: NOW });
      const other = new pkg.Client({ connectionString: divisionsUrl });
      await other.connect();
      try {
        await other.query('select pg_advisory_lock($1::bigint)', [repo.DIVISION_EVIDENCE_LOCK]);
        let done = false;
        const sync = divisions.syncDivisionEvidence(NOW).then(() => {
          done = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(done).toBe(false);
        await other.query('select pg_advisory_unlock($1::bigint)', [repo.DIVISION_EVIDENCE_LOCK]);
        await sync;
        expect(done).toBe(true);
        expect(await evidence()).toHaveLength(3);
      } finally {
        await other.end();
      }
    });

    it('recomputes from the committed rows: a full rebuild afterwards changes no TD profile', async () => {
      await seedLobbies();
      await divisions.classifyDivisions({ complete: stub().complete, now: NOW });
      await divisions.syncDivisionEvidence(); // the real clock, as recalculateAll uses: decay depends on it
      const key = (p: { subjectId: string } & Record<string, unknown>) =>
        `${p.subjectId}:${['economic', 'social', 'welfare', 'environmental'].map((d) => p[d]).join(',')}`;
      const before = (await repo.listProfiles('td')).map(key).sort();
      expect(before).toHaveLength(9);
      await ideology.recalculateAll();
      expect((await repo.listProfiles('td')).map(key).sort()).toEqual(before);
    });

    it('an Independent with division evidence is matched once it is measured on four dimensions (plan 03)', async () => {
      const independent = await addTd('Ind Voter', 'Independent');
      const leans = (user: string) =>
        user.includes('Three')
          ? answer({ ta_lean: { economic: -2, welfare: -2, social: -1 }, nil_lean: {} })
          : answer({ ta_lean: { authority: 2 }, nil_lean: {} });
      const position = { economic: -8, social: -4, cultural: 0, authority: 6, environmental: 0, welfare: -8, globalism: 0, technocratic: 0 };

      await addDivision('three', '2025-06-10', 'Three');
      await vote('three', independent, 'ta');
      await divisions.classifyDivisions({ complete: stub(leans).complete, now: NOW });
      await divisions.syncDivisionEvidence(NOW);
      expect((await ideology.matchesFor(position)).tds).toEqual([]);

      await addDivision('fourth', '2025-06-11', 'Fourth');
      await vote('fourth', independent, 'ta');
      await divisions.classifyDivisions({ complete: stub(leans).complete, now: NOW });
      await divisions.syncDivisionEvidence(NOW);
      const [td] = (await ideology.matchesFor(position)).tds;
      expect(td).toMatchObject({ tdId: independent, measured: ['economic', 'social', 'authority', 'welfare'], evidenceBySource: { division: 2 } });
    });
  });

  describe('the nightly run', () => {
    it('reads at most NIGHTLY_LIMIT divisions, syncs evidence, and logs one line', async () => {
      const independent = await addTd('Ind Voter', 'Independent');
      for (let k = 0; k <= divisions.NIGHTLY_LIMIT; k++) {
        const id = `n${String(k).padStart(2, '0')}`;
        await addDivision(id, `2025-0${1 + Math.floor(k / 28)}-${String(1 + (k % 28)).padStart(2, '0')}`);
        await vote(id, independent, 'ta');
      }
      const model = stub();
      const lines: string[] = [];
      const summary = await divisions.runDivisionIdeology({ mode: 'nightly', complete: model.complete, llmConfigured: true, now: NOW, log: (l) => lines.push(l) });
      expect(model.prompts).toHaveLength(divisions.NIGHTLY_LIMIT);
      expect(summary.classify).toMatchObject({ pending: divisions.NIGHTLY_LIMIT + 1, read: divisions.NIGHTLY_LIMIT });
      expect(summary.evidence.rows).toBe(divisions.NIGHTLY_LIMIT);
      expect(await evidence()).toHaveLength(divisions.NIGHTLY_LIMIT);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^\[division-ideology\] .*2000 prompt \+ 400 completion tokens/);
    });

    it('with no LLM configured it reads nothing and still syncs evidence', async () => {
      await seedLobbies();
      await divisions.classifyDivisions({ complete: stub().complete, now: NOW });
      const model = stub();
      const summary = await nightly(model.complete, false);
      expect(model.prompts).toHaveLength(0);
      expect(summary.classify).toBeNull();
      expect(await evidence()).toHaveLength(3);
    });

    it('refuses a second run while one is in flight', async () => {
      await addDivision('d1', '2025-06-10');
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const slow: DivisionCompletion = async () => {
        await gate;
        return { content: answer(), model: 'stub-model', promptTokens: 1, completionTokens: 1 };
      };
      const first = nightly(slow);
      await expect(nightly(slow)).rejects.toBeInstanceOf(divisions.DivisionIdeologyAlreadyRunning);
      release();
      await first;
      await expect(nightly(slow)).resolves.toBeDefined();
    });
  });

  describe('the audit', () => {
    const row = (divisionId: string, taLean: Record<string, number>, nilLean: Record<string, number>, confidence = 1) => ({
      divisionId,
      status: 'classified' as const,
      taLean,
      nilLean,
      confidence,
      taMeans: `${divisionId} means`,
    });
    const votesOf = (divisionId: string) => [
      { divisionId, party: 'Sinn Féin', vote: 'ta' as const },
      { divisionId, party: 'Sinn Féin', vote: 'ta' as const },
      { divisionId, party: 'Fine Gael', vote: 'nil' as const },
      { divisionId, party: 'Independent', vote: 'nil' as const }, // no baseline: left out of the lobby means
    ];

    it("counts how often a reading's Tá−Níl direction agrees with the lobbies' party baselines", () => {
      // SF economic −6, FG +1.5: the Tá lobby is 7.5 to the left. Welfare −7 vs +0.5.
      const audit = divisions.auditDivisions(
        [
          row('agrees', { economic: -2, welfare: -1.5 }, { economic: 2 }),
          row('disagrees', { economic: 2, welfare: 1 }, { economic: -2, welfare: -1 }),
          row('weak', { economic: 0.4 }, {}), // |lean| < 0.5: not counted
          row('unsure', { economic: 2 }, {}, 0.4), // below MIN_DIVISION_CONFIDENCE: not counted
        ],
        [...votesOf('agrees'), ...votesOf('disagrees'), ...votesOf('weak'), ...votesOf('unsure')],
      );
      expect(audit.byDimension.economic).toEqual({ agree: 1, total: 2 });
      expect(audit.byDimension.welfare).toEqual({ agree: 1, total: 2 });
      expect(audit.byDimension.social).toEqual({ agree: 0, total: 0 });
      expect(audit).toMatchObject({ divisions: 2, agree: 2, total: 4 });
      expect(audit.worst.map((w) => [w.divisionId, w.disagreements.map((d) => d.dimension)])).toEqual([['disagrees', ['economic', 'welfare']]]);
    });

    it('--resample re-reads stored readings and reports sign stability, writing nothing', async () => {
      await addDivision('d1', '2025-06-10');
      await addDivision('d2', '2025-06-11');
      await divisions.classifyDivisions({ complete: stub().complete, now: NOW });
      const before = await readings();
      const flipped = stub((user) => (user.includes('2025-06-10') ? answer({ ta_lean: RIGHT }) : answer()));
      const result = await divisions.runDivisionAudit({ resample: 2, complete: flipped.complete });
      expect(flipped.prompts).toHaveLength(2);
      // LEFT has 4 dimensions at |lean| ≥ 0.5: d2 keeps all 4, d1 flips all 4.
      expect(result.resample).toMatchObject({ divisions: 2, stable: 4, total: 8, failed: 0, promptTokens: 200 });
      expect(await readings()).toEqual(before);
    });
  });
});

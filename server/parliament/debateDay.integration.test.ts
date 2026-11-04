/**
 * replaceDebateDay's diff against the delete-and-reinsert it replaced: the same sequence of
 * transcripts (a first read, another day, a corrected transcript that drops a section and a
 * speech and changes and adds others, then the same transcript again) leaves exactly the same
 * sections and speeches. The diff also rewrites nothing on an unchanged re-read, and keeps the
 * debate_id the grouping step set. Skipped unless TEST_DATABASE_URL is set; uses its own
 * database, `<db>_debateday`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55471/postgres"
 *   npx vitest run server/parliament/debateDay.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NewDebateSection } from '@shared/schema/parliament';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';
import type { ParsedSpeech } from './parse';

const url = testDatabaseUrl('debateday');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const D1 = '2026-09-23';
const D2 = '2026-09-24';
const CODES = ['A.D.2020', 'B.D.2020', 'C.D.2020', 'Not-Yet-In-Roster.D.2026'];

type Day = { date: string; sections: NewDebateSection[]; speeches: ParsedSpeech[] };

/** A day of `n` sections (the third nested under the second), each with 6 speeches. */
function day(date: string, n: number): Day {
  const sections: NewDebateSection[] = Array.from({ length: n }, (_, k) => ({
    id: `dail-${date}-dbsect_${k + 1}`,
    date,
    title: `Section ${k + 1}`,
    parentId: k === 2 ? `dail-${date}-dbsect_2` : null,
    parentTitle: k === 2 ? 'Section 2' : null,
    speechCount: 6,
  }));
  const speeches: ParsedSpeech[] = sections.flatMap((s) =>
    Array.from({ length: 6 }, (_, p) => ({
      id: `${s.id}/spk_${p}`,
      sectionId: s.id,
      date,
      position: p,
      memberCode: p === 5 ? null : CODES[p % CODES.length],
      role: p === 1 ? 'Minister for Health' : null,
      isPresiding: p === 0,
      text: `${s.id} speech ${p}`,
      wordCount: 3,
    })),
  );
  return { date, sections, speeches };
}

/** The first day as a corrected transcript publishes it. */
function corrected(): Day {
  const d = day(D1, 4);
  const sections = d.sections.filter((s) => s.id !== `dail-${D1}-dbsect_4`).map((s) => (s.id.endsWith('_1') ? { ...s, title: 'Section 1 (corrected)', speechCount: 7 } : s));
  const speeches = d.speeches
    .filter((s) => s.sectionId !== `dail-${D1}-dbsect_4` && s.id !== `dail-${D1}-dbsect_2/spk_3`)
    .map((s) => (s.id === `dail-${D1}-dbsect_1/spk_2` ? { ...s, text: 'a corrected speech', wordCount: 3, role: 'Tánaiste' } : s));
  speeches.push({ ...speeches[0], id: `dail-${D1}-dbsect_1/spk_6`, position: 6, memberCode: CODES[3], isPresiding: false, text: 'added late' });
  return { date: D1, sections, speeches };
}

run('replaceDebateDay (real Postgres)', () => {
  let dbmod: typeof import('../db');
  let repo: typeof import('./repository');
  let tdIds: Map<string, number>;
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);

  /** The delete-and-reinsert this replaced, verbatim in behaviour. */
  async function oldReplace({ date, sections, speeches }: Day): Promise<void> {
    const { db } = dbmod;
    const { debateSections, debateSpeeches } = await import('@shared/schema/parliament');
    const { eq } = await import('drizzle-orm');
    await db.transaction(async (tx) => {
      await tx.delete(debateSections).where(eq(debateSections.date, date));
      await tx.insert(debateSections).values(sections);
      await tx.insert(debateSpeeches).values(speeches.map((s) => ({ ...s, tdId: s.memberCode ? (tdIds.get(s.memberCode) ?? null) : null })));
    });
  }

  const contents = async () => ({
    sections: (await q('select id, date::text, title, parent_id, parent_title, speech_count from politics.debate_sections order by id collate "C"')).rows,
    speeches: (
      await q('select id, section_id, date::text, position, member_code, td_id, role, is_presiding, text, word_count from politics.debate_speeches order by id collate "C"')
    ).rows,
  });
  const xmins = async () => (await q('select id, xmin::text from politics.debate_speeches order by id collate "C"')).rows;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('./repository');
    for (const c of CODES.slice(0, 3)) await q('insert into politics.tds (name, member_code) values ($1, $1)', [c]);
    tdIds = await repo.tdIdsByMemberCode();
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('leaves the same sections and speeches as delete-and-reinsert, and writes nothing on an unchanged re-read', async () => {
    const steps = [day(D1, 4), day(D2, 3), corrected(), corrected()];

    for (const s of steps) await oldReplace(s);
    const old = await contents();
    await q('truncate politics.debate_sections cascade');

    for (const s of steps.slice(0, 3)) await repo.replaceDebateDay(s.date, s.sections, s.speeches, tdIds);
    await q(`update politics.debate_sections set debate_id = id where date = $1`, [D1]);
    const before = await xmins();
    await repo.replaceDebateDay(D1, steps[3].sections, steps[3].speeches, tdIds);

    expect(await contents()).toEqual(old);
    // Not vacuous: the correction dropped a section and a speech, changed two rows, added one.
    expect(old.sections).toHaveLength(6);
    expect(old.speeches).toHaveLength(6 * 6 - 1 + 1);
    expect(old.speeches.find((s: { id: string }) => s.id === `dail-${D1}-dbsect_1/spk_2`)).toMatchObject({ text: 'a corrected speech', role: 'Tánaiste' });
    // The unchanged re-read rewrote no speech, and the grouping's debate_id survived it.
    expect(await xmins()).toEqual(before);
    const kept = await q(`select count(*)::int n from politics.debate_sections where date = $1 and debate_id = id`, [D1]);
    expect(kept.rows[0].n).toBe(3);
  });

  it('a day whose transcript now has no sections is emptied', async () => {
    await repo.replaceDebateDay(D2, [], [], tdIds);
    const { rows } = await q(`select count(*)::int n from politics.debate_speeches where date = $1`, [D2]);
    expect(rows[0].n).toBe(0);
    expect((await q(`select count(*)::int n from politics.debate_sections where date = $1`, [D1])).rows[0].n).toBe(3);
  });
});

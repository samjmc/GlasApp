/**
 * Debate items (Step 2 of docs/plans/debate-analysis.md): the reads the extractor needs and the
 * one write that stores a debate's run. Items and their run are written together or not at all.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  debateExtractionRuns,
  debateItems,
  tdOffices,
  type DebateKind,
  type NewDebateExtractionRun,
  type NewDebateItem,
} from '@shared/schema/parliament';
import { db, type Db } from '../../db';
import type { GovernmentOffices } from '../debateItems/verify';
import type { DebateSpeech } from '../debateItems/windows';

/** The kinds that are argued, and so read for items. Question sessions need rules of their own. */
export const ARGUED_KINDS: readonly DebateKind[] = ['bill_stage', 'motion', 'statements'];

export interface ArguedDebate {
  id: string;
  kind: DebateKind;
  title: string;
  speakers: number;
  words: number;
}

/** Argued debates with at least two members speaking, chair excluded. */
export async function arguedDebates(database: Db = db): Promise<ArguedDebate[]> {
  const res = await database.execute(sql`
    select d.id, d.kind, d.title, count(distinct p.member_code)::int speakers, coalesce(sum(p.word_count), 0)::int words
    from politics.debates d
    join politics.debate_sections s on s.debate_id = d.id
    join politics.debate_speeches p on p.section_id = s.id and not p.is_presiding and p.member_code is not null
    where d.kind in ('bill_stage', 'motion', 'statements')
    group by d.id
    having count(distinct p.member_code) >= 2
    order by d.first_date, d.id`);
  return (res.rows as Array<{ id: string; kind: DebateKind; title: string; speakers: number; words: number }>).map((r) => ({
    ...r,
    speakers: Number(r.speakers),
    words: Number(r.words),
  }));
}

/** A debate's member speeches in record order (day, then section, then position), chair excluded. */
export async function debateSpeechesOf(debateId: string, database: Db = db): Promise<DebateSpeech[]> {
  const res = await database.execute(sql`
    select p.id, p.member_code, p.role, p.text, p.word_count, p.date::text date, t.name
    from politics.debate_speeches p
    join politics.debate_sections s on s.id = p.section_id
    left join politics.tds t on t.member_code = p.member_code
    where s.debate_id = ${debateId} and not p.is_presiding and p.member_code is not null
    order by s.date, coalesce(substring(s.id from 'dbsect_([0-9]+)$')::int, 0), p.position`);
  return (res.rows as Array<{ id: string; member_code: string; role: string | null; text: string; word_count: number; date: string; name: string | null }>).map((r) => {
    // A member who left the Dáil has no tds row: "Paschal-Donohoe.D.2011-03-09" → "Paschal Donohoe".
    const name = r.name ?? r.member_code.split('.')[0]!.replace(/-/g, ' ');
    return { id: r.id, memberCode: r.member_code, speaker: r.role ? `${name} (${r.role})` : name, date: r.date, text: r.text, wordCount: Number(r.word_count) };
  });
}

/** debate id → its run for this extractor version. */
export async function extractionRunsFor(version: string, database: Db = db): Promise<Map<string, { inputHash: string; status: string }>> {
  const rows = await database
    .select({ debateId: debateExtractionRuns.debateId, inputHash: debateExtractionRuns.inputHash, status: debateExtractionRuns.status })
    .from(debateExtractionRuns)
    .where(eq(debateExtractionRuns.extractorVersion, version));
  return new Map(rows.map((r) => [r.debateId, { inputHash: r.inputHash, status: r.status }]));
}

/** Who held cabinet or Minister of State office, and when. A commitment needs one of these. */
export async function governmentOffices(database: Db = db): Promise<GovernmentOffices> {
  const rows = await database
    .select({ memberCode: tdOffices.memberCode, start: tdOffices.startDate, end: tdOffices.endDate })
    .from(tdOffices)
    .where(inArray(tdOffices.officeType, ['cabinet', 'minister_of_state']));
  const out: GovernmentOffices = new Map();
  for (const r of rows) out.set(r.memberCode, [...(out.get(r.memberCode) ?? []), { start: r.start, end: r.end }]);
  return out;
}

/** Remove items whose speech, or whose target speech, is no longer in the record. */
export async function deleteOrphanItems(database: Db = db): Promise<number> {
  const res = await database.execute(sql`
    delete from politics.debate_items i
    where not exists (select 1 from politics.debate_speeches s where s.id = i.speech_id)
       or (i.target_speech_id is not null and not exists (select 1 from politics.debate_speeches s where s.id = i.target_speech_id))`);
  return Number((res as { rowCount?: number }).rowCount ?? 0);
}

/**
 * Store one debate's run. A finished run replaces this version's items for the debate's speeches;
 * a failed run (`items` null) records the failure and leaves any items alone.
 */
export async function saveExtraction(run: NewDebateExtractionRun, speechIds: string[], items: NewDebateItem[] | null, database: Db = db): Promise<void> {
  await database.transaction(async (tx) => {
    if (items !== null && speechIds.length > 0) {
      await tx.delete(debateItems).where(and(inArray(debateItems.speechId, speechIds), eq(debateItems.extractorVersion, run.extractorVersion)));
      for (let i = 0; i < items.length; i += 500) await tx.insert(debateItems).values(items.slice(i, i + 500));
    }
    const set: Partial<NewDebateExtractionRun> = { ...run, ranAt: new Date() };
    delete set.debateId;
    delete set.extractorVersion;
    await tx
      .insert(debateExtractionRuns)
      .values(run)
      .onConflictDoUpdate({ target: [debateExtractionRuns.debateId, debateExtractionRuns.extractorVersion], set });
  });
}

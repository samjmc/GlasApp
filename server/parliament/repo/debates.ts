/**
 * Debates: groups of debate sections (see ../debateGroups.ts). Rebuilt in full by every sync
 * from what is stored, so a re-ingested day or a corrected transcript regroups too.
 */
import { asc, eq, like, sql } from 'drizzle-orm';
import { billDebates, billSponsors, debates, debateSections, tdOffices, type NewDebate } from '@shared/schema/parliament';
import { db, type Db } from '../../db';
import { groupDebates, moverOf } from '../debateGroups';
import { chunks } from './util';

/** How many of the most common unlisted headings the sync log names. */
const UNKNOWN_HEADINGS_LOGGED = 5;

export interface RegroupResult {
  debates: number;
  sections: number;
  /** The most common headings of kind `other`, so the lists in debateGroups.ts can grow. */
  unknownHeadings: string[];
}

export async function regroupDebates(database: Db = db): Promise<RegroupResult> {
  const [sections, links, sponsors, offices, firsts] = await Promise.all([
    database
      .select({ id: debateSections.id, date: debateSections.date, title: debateSections.title, parentId: debateSections.parentId, parentTitle: debateSections.parentTitle })
      .from(debateSections),
    database
      .select({ sectionId: billDebates.debateSectionId, billId: billDebates.billId })
      .from(billDebates)
      .where(like(billDebates.debateSectionId, 'dail-%')),
    database
      .select({ billId: billSponsors.billId, memberCode: billSponsors.memberCode, label: billSponsors.label })
      .from(billSponsors)
      .where(eq(billSponsors.isPrimary, true))
      .orderBy(asc(billSponsors.billId), asc(billSponsors.position)),
    database
      .select({ title: tdOffices.title, memberCode: tdOffices.memberCode, start: tdOffices.startDate, end: tdOffices.endDate })
      .from(tdOffices),
    database.execute(sql`
      select distinct on (section_id) section_id, member_code
      from politics.debate_speeches
      where not is_presiding and member_code is not null
      order by section_id, position`),
  ]);

  const primarySponsors = new Map<string, { memberCode: string | null; label: string }>();
  for (const s of sponsors) if (!primarySponsors.has(s.billId)) primarySponsors.set(s.billId, { memberCode: s.memberCode, label: s.label });
  const firstSpeakers = new Map((firsts.rows as Array<{ section_id: string; member_code: string }>).map((r) => [r.section_id, r.member_code]));

  const grouped = groupDebates(sections, links);
  const rows: NewDebate[] = grouped.map((d) => {
    const mover = moverOf(d, { primarySponsors, offices, firstSpeakers });
    return {
      id: d.id,
      kind: d.kind,
      title: d.title,
      billId: d.billId,
      firstDate: d.firstDate,
      lastDate: d.lastDate,
      sectionCount: d.sectionIds.length,
      moverMemberCode: mover?.memberCode ?? null,
      moverSource: mover?.source ?? null,
    };
  });
  const assigned = grouped.flatMap((d) => d.sectionIds.map((id) => ({ id, debate_id: d.id })));

  await database.transaction(async (tx) => {
    await tx.delete(debates);
    for (const batch of chunks(rows)) await tx.insert(debates).values(batch);
    // One JSON parameter: Drizzle expands a JS array into a list of parameters, not an array.
    await tx.execute(sql`
      update politics.debate_sections s set debate_id = v.debate_id
      from jsonb_to_recordset(${JSON.stringify(assigned)}::jsonb) as v(id text, debate_id text)
      where s.id = v.id and s.debate_id is distinct from v.debate_id`);
  });

  const unknown = new Map<string, number>();
  for (const d of grouped) if (d.kind === 'other') unknown.set(d.title, (unknown.get(d.title) ?? 0) + 1);
  const unknownHeadings = Array.from(unknown)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, UNKNOWN_HEADINGS_LOGGED)
    .map(([title, n]) => `${title} (${n})`);
  return { debates: rows.length, sections: assigned.length, unknownHeadings };
}

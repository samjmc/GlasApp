/**
 * Offices and documented absences: the record of WHY a TD was not expected to vote or ask
 * questions. Both are replaced whole on every sync; td_parliament_stats reads them.
 */
import { eq, sql } from 'drizzle-orm';
import { tdAbsences, tdOffices } from '@shared/schema/parliament';
import { tds } from '@shared/schema/politics';
import type { TdAbsence, TdOfficePeriod } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import type { DocumentedAbsence } from '../absences';
import type { RosterMember } from '../client';
import type { DayRange } from '../metrics';
import { chunks } from './util';

export async function replaceOffices(roster: RosterMember[], tdIds: Map<string, number>, database: Db = db): Promise<number> {
  // One title can be listed twice with the same start (a data repeat): keep the latest end.
  const byKey = new Map<string, typeof tdOffices.$inferInsert>();
  for (const m of roster) {
    for (const o of m.officeHistory) {
      const key = `${m.memberCode}\u0000${o.title}\u0000${o.start}`;
      const prev = byKey.get(key);
      if (prev && (prev.endDate === null || (o.end !== null && o.end <= (prev.endDate ?? '')))) continue;
      byKey.set(key, { memberCode: m.memberCode, tdId: tdIds.get(m.memberCode) ?? null, title: o.title, officeType: o.type, startDate: o.start, endDate: o.end });
    }
  }
  const rows = Array.from(byKey.values());
  await database.transaction(async (tx) => {
    await tx.delete(tdOffices);
    for (const batch of chunks(rows)) await tx.insert(tdOffices).values(batch);
  });
  return rows.length;
}

export async function replaceAbsences(entries: DocumentedAbsence[], tdIds: Map<string, number>, database: Db = db): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.delete(tdAbsences);
    if (entries.length === 0) return;
    await tx.insert(tdAbsences).values(
      entries.map((e) => ({
        memberCode: e.memberCode,
        tdId: tdIds.get(e.memberCode) ?? null,
        startDate: e.from,
        endDate: e.to,
        reason: e.reason,
        sourceUrl: e.source,
        note: e.note,
      })),
    );
  });
}

/** Per member code: the office periods of the given types and the documented absences. */
export async function fairnessPeriods(
  officeTypes: readonly string[],
  database: Pick<Db, 'select'> = db,
): Promise<{ offices: Map<string, DayRange[]>; absences: Map<string, DayRange[]> }> {
  const [officeRows, absenceRows] = await Promise.all([
    database.select().from(tdOffices),
    database.select().from(tdAbsences),
  ]);
  const push = (map: Map<string, DayRange[]>, code: string, r: DayRange) => map.set(code, [...(map.get(code) ?? []), r]);
  const offices = new Map<string, DayRange[]>();
  for (const o of officeRows) if (officeTypes.includes(o.officeType)) push(offices, o.memberCode, { start: o.startDate, end: o.endDate });
  const absences = new Map<string, DayRange[]>();
  for (const a of absenceRows) push(absences, a.memberCode, { start: a.startDate, end: a.endDate });
  return { offices, absences };
}

/** A TD's documented absences, newest first, for the profile. */
export async function tdAbsencesOf(tdId: number, database: Db = db): Promise<TdAbsence[]> {
  const rows = await database
    .select({ from: tdAbsences.startDate, to: tdAbsences.endDate, reason: tdAbsences.reason, sourceUrl: tdAbsences.sourceUrl })
    .from(tdAbsences)
    .innerJoin(tds, eq(tds.memberCode, tdAbsences.memberCode))
    .where(eq(tds.id, tdId));
  return rows.sort((a, b) => (a.from < b.from ? 1 : -1));
}

/** Every office a TD held in the current Dáil, newest first. */
export async function tdOfficeHistory(tdId: number, database: Db = db): Promise<TdOfficePeriod[]> {
  const rows = await database
    .select({ title: tdOffices.title, type: tdOffices.officeType, start: tdOffices.startDate, end: tdOffices.endDate })
    .from(tdOffices)
    .innerJoin(tds, eq(tds.memberCode, tdOffices.memberCode))
    .where(eq(tds.id, tdId));
  return rows.sort((a, b) => (a.start < b.start ? 1 : -1));
}

export interface Silence {
  memberCode: string;
  name: string;
  from: string;
  to: string;
  sittingDays: number;
}

/**
 * Runs of `minDays`+ consecutive sitting days on which an active TD neither voted nor spoke,
 * and which no documented absence covers. For a person to look into; never scored as leave.
 */
export async function undocumentedSilences(minDays: number, database: Db = db): Promise<Silence[]> {
  const res = await database.execute(sql`
    with days as (select distinct date from politics.debate_sections),
    active as (
      select v.member_code, d.date from politics.division_votes v join politics.divisions d on d.id = v.division_id
      union select member_code, date from politics.debate_speeches where member_code is not null),
    grid as (
      -- A documented leave day is not silent: it ends a run rather than being skipped, so the
      -- days either side of a leave are two runs, not one.
      select t.member_code, t.name, x.date,
        (a.member_code is null and not exists (
          select 1 from politics.td_absences ab
          where ab.member_code = t.member_code and x.date >= ab.start_date and (ab.end_date is null or x.date <= ab.end_date))) is_silent,
        row_number() over (partition by t.member_code order by x.date) rn
      from politics.tds t
      join politics.td_parliament_stats s on s.td_id = t.id
      join days x on x.date >= s.member_since
      left join (select distinct member_code, date from active) a on a.member_code = t.member_code and a.date = x.date
      where t.is_active),
    runs as (
      select member_code, name, min(date) run_from, max(date) run_to, count(*)::int n
      from (select *, rn - row_number() over (partition by member_code, is_silent order by date) grp from grid) q
      where is_silent
      group by member_code, name, grp)
    select member_code, name, run_from::text, run_to::text, n from runs where n >= ${minDays} order by n desc, name`);
  return (res.rows as Array<{ member_code: string; name: string; run_from: string; run_to: string; n: number }>).map((r) => ({
    memberCode: r.member_code,
    name: r.name,
    from: r.run_from,
    to: r.run_to,
    sittingDays: Number(r.n),
  }));
}

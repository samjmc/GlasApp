/**
 * Committees: memberships from the roster, sittings and roll calls from committee
 * transcripts. Joined to TDs by member code, re-linked like votes and speeches.
 */
import { asc, eq, sql } from 'drizzle-orm';
import { committeeAttendance, committeeMemberships, committees, committeeSittings } from '@shared/schema/parliament';
import type { TdCommittee } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import type { RosterMember } from '../client';
import { uriTail } from '../parse';
import { chunks } from './util';

/** Replace every committee membership with the roster's view. Memberships are few (~700). */
export async function replaceCommitteeMemberships(roster: RosterMember[], tdIds: Map<string, number>, database: Db = db): Promise<number> {
  const seenCommittees = new Map<string, { id: string; uri: string; name: string; committeeType: string | null }>();
  // The roster can list one membership twice with different ends (a one-day entry and an
  // open one); keep the latest end, an open membership counting as latest.
  const byKey = new Map<string, typeof committeeMemberships.$inferInsert>();
  for (const m of roster) {
    for (const c of m.committees) {
      const id = uriTail(c.uri);
      seenCommittees.set(id, { id, uri: c.uri, name: c.name, committeeType: c.committeeType });
      const key = `${id}\u0000${m.memberCode}\u0000${c.start}`;
      const prev = byKey.get(key);
      if (prev && (prev.endDate === null || (c.end !== null && c.end <= (prev.endDate ?? '')))) continue;
      byKey.set(key, { committeeId: id, memberCode: m.memberCode, tdId: tdIds.get(m.memberCode) ?? null, role: c.role, startDate: c.start, endDate: c.end });
    }
  }
  const memberships = Array.from(byKey.values());
  await database.transaction(async (tx) => {
    for (const batch of chunks(Array.from(seenCommittees.values()))) {
      await tx
        .insert(committees)
        .values(batch)
        .onConflictDoUpdate({ target: committees.id, set: { name: sql`excluded.name`, committeeType: sql`excluded.committee_type`, uri: sql`excluded.uri` } });
    }
    await tx.delete(committeeMemberships);
    for (const batch of chunks(memberships)) await tx.insert(committeeMemberships).values(batch);
  });
  return memberships.length;
}

/** Replace one sitting and its roll call. The committee row is created if the roster never named it. */
export async function replaceCommitteeSitting(
  sitting: { uri: string; date: string; committeeUri: string; committeeName: string },
  present: string[],
  unresolvedCount: number,
  tdIds: Map<string, number>,
  database: Db = db,
): Promise<void> {
  const committeeId = uriTail(sitting.committeeUri);
  await database.transaction(async (tx) => {
    await tx.insert(committees).values({ id: committeeId, uri: sitting.committeeUri, name: sitting.committeeName }).onConflictDoNothing();
    await tx
      .insert(committeeSittings)
      .values({ uri: sitting.uri, committeeId, date: sitting.date, presentCount: present.length, unresolvedCount })
      .onConflictDoUpdate({ target: committeeSittings.uri, set: { presentCount: present.length, unresolvedCount, date: sitting.date, committeeId } });
    await tx.delete(committeeAttendance).where(eq(committeeAttendance.sittingUri, sitting.uri));
    if (present.length > 0) {
      await tx.insert(committeeAttendance).values(present.map((memberCode) => ({ sittingUri: sitting.uri, memberCode, tdId: tdIds.get(memberCode) ?? null })));
    }
  });
}

/**
 * SQL for one TD's committee sittings: those of committees they belonged to, held inside
 * that membership, after they joined the current Dáil, with a roll call at all (a
 * transcript without one says nothing about who came), and with no unmatched name on it
 * (an unmatched TD could be this one, so the sitting cannot count them absent).
 */
const ELIGIBLE_SITTINGS = sql`
  select distinct s.uri, s.committee_id
  from politics.committee_sittings s
  join politics.committee_memberships m on m.committee_id = s.committee_id
  where m.td_id = st.td_id
    and s.date >= m.start_date and (m.end_date is null or s.date <= m.end_date)
    and s.date >= st.member_since
    and s.present_count > 0
    and s.unresolved_count = 0`;

/** Fill the committee columns of `td_parliament_stats` (rows must exist; see recomputeStats). */
export async function recomputeCommitteeStats(database: Db = db): Promise<void> {
  await database.execute(sql`
    update politics.td_parliament_stats st set
      committee_sittings_eligible = (select count(*) from (${ELIGIBLE_SITTINGS}) e),
      committee_sittings_attended = (select count(*) from (${ELIGIBLE_SITTINGS}) e
        where exists (select 1 from politics.committee_attendance a where a.sitting_uri = e.uri and a.td_id = st.td_id))`);
}

export async function tdCommittees(tdId: number, database: Db = db): Promise<TdCommittee[]> {
  const rows = await database
    .select({
      committeeId: committees.id,
      name: committees.name,
      committeeType: committees.committeeType,
      role: committeeMemberships.role,
      start: committeeMemberships.startDate,
      end: committeeMemberships.endDate,
      // Correlated on the outer row, qualified by hand: Drizzle can drop table names from
      // select-list SQL, and a bare "committee_id" would bind to the subquery's own table.
      // Same rules as ELIGIBLE_SITTINGS, so the per-committee rows add up to the headline.
      sittingsEligible: sql<number>`(
        select count(*)::int from politics.committee_sittings s
        where s.committee_id = "committee_memberships"."committee_id"
          and s.date >= "committee_memberships"."start_date"
          and ("committee_memberships"."end_date" is null or s.date <= "committee_memberships"."end_date")
          and s.date >= (select p.member_since from politics.td_parliament_stats p where p.td_id = "committee_memberships"."td_id")
          and s.present_count > 0
          and s.unresolved_count = 0)`,
      sittingsAttended: sql<number>`(
        select count(*)::int from politics.committee_sittings s
        join politics.committee_attendance a on a.sitting_uri = s.uri and a.td_id = "committee_memberships"."td_id"
        where s.committee_id = "committee_memberships"."committee_id"
          and s.date >= "committee_memberships"."start_date"
          and ("committee_memberships"."end_date" is null or s.date <= "committee_memberships"."end_date")
          and s.date >= (select p.member_since from politics.td_parliament_stats p where p.td_id = "committee_memberships"."td_id")
          and s.unresolved_count = 0)`,
    })
    .from(committeeMemberships)
    .innerJoin(committees, eq(committees.id, committeeMemberships.committeeId))
    .where(eq(committeeMemberships.tdId, tdId))
    // Current memberships first, then chairs and vice-chairs, then by name.
    .orderBy(sql`${committeeMemberships.endDate} is not null`, sql`${committeeMemberships.role} is null`, asc(committees.name));
  return rows.map((r) => ({ ...r, sittingsEligible: Number(r.sittingsEligible), sittingsAttended: Number(r.sittingsAttended) }));
}

/** Names of the committees a TD sits on now, for the `tds.committees` profile column. */
export function currentCommitteeNames(member: RosterMember): string[] {
  return member.committees.filter((c) => !c.end).map((c) => c.name);
}

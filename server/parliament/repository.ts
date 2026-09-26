/**
 * Every read and write of the parliament tables. Nothing else in the app queries them.
 * Divisions, debates and the per-TD record live here; committees, bills and question
 * counts live in ./repo/ and are re-exported, so callers see one `repository`.
 */
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  debateSections,
  debateSpeeches,
  divisions,
  divisionVotes,
  parliamentSyncState,
  tdParliamentStats,
  type NewDebateSection,
  type NewDebateSpeech,
  type TdParliamentStatsRow,
} from '@shared/schema/parliament';
import { tds } from '@shared/schema/politics';
import type {
  DebateSectionDetail,
  DebateSectionSummary,
  DivisionDetail,
  DivisionSummary,
  LeaderboardEntry,
  LeaderboardMetric,
  PartyParliamentSummary,
  TdDebateContribution,
  TdVote,
} from '@shared/parliamentApi';
import { db, type Db } from '../db';
import { countBillsSponsored } from './repo/bills';
import {
  committeeAttendancePct,
  INDEPENDENT,
  MIN_COMMITTEE_SITTINGS,
  MIN_SITTING_DAYS,
  majorityFor,
  partyLinePct,
  partyMajorities,
  type PartyVoteRow,
} from './metrics';
import type { ParsedDivision, ParsedSpeech } from './parse';

import { chunks } from './repo/util';

export * from './repo/committees';
export * from './repo/bills';
export * from './repo/questions';
export * from './repo/divisions';

/** The byParty group for voters who are not in `tds`. */
export const NOT_IN_ROSTER = 'Not in current roster';

// ---------------------------------------------------------------------------
// Writes (sync only)
// ---------------------------------------------------------------------------

/** member code → td id for every TD, active or not, so old votes still link. */
export async function tdIdsByMemberCode(database: Db = db): Promise<Map<string, number>> {
  const rows = await database.select({ id: tds.id, code: tds.memberCode }).from(tds).where(isNotNull(tds.memberCode));
  return new Map(rows.map((r) => [r.code as string, r.id]));
}

/** Replace these divisions and their votes. Idempotent: re-ingesting a day changes nothing. */
export async function upsertDivisions(parsed: ParsedDivision[], tdIds: Map<string, number>, database: Db = db): Promise<void> {
  if (parsed.length === 0) return;
  await database.transaction(async (tx) => {
    for (const batch of chunks(parsed.map((p) => p.division))) {
      await tx
        .insert(divisions)
        .values(batch)
        .onConflictDoUpdate({
          target: divisions.id,
          set: {
            uri: sql`excluded.uri`,
            heldAt: sql`excluded.held_at`,
            subject: sql`excluded.subject`,
            outcome: sql`excluded.outcome`,
            debateTitle: sql`excluded.debate_title`,
            debateSectionId: sql`excluded.debate_section_id`,
            isBill: sql`excluded.is_bill`,
            taCount: sql`excluded.ta_count`,
            nilCount: sql`excluded.nil_count`,
            staonCount: sql`excluded.staon_count`,
          },
        });
    }
    await tx.delete(divisionVotes).where(inArray(divisionVotes.divisionId, parsed.map((p) => p.division.id)));
    const votes = parsed.flatMap((p) =>
      p.votes.map((v) => ({ divisionId: p.division.id, memberCode: v.memberCode, vote: v.vote, tdId: tdIds.get(v.memberCode) ?? null })),
    );
    for (const batch of chunks(votes)) await tx.insert(divisionVotes).values(batch);
  });
}

/** Replace one sitting day's sections and speeches. */
export async function replaceDebateDay(
  date: string,
  sections: NewDebateSection[],
  speeches: ParsedSpeech[],
  tdIds: Map<string, number>,
  database: Db = db,
): Promise<void> {
  await database.transaction(async (tx) => {
    // Cascades to the day's speeches; a section dropped from a corrected transcript goes too.
    await tx.delete(debateSections).where(eq(debateSections.date, date));
    for (const batch of chunks(sections)) await tx.insert(debateSections).values(batch);
    const rows: NewDebateSpeech[] = speeches.map((s) => ({ ...s, tdId: s.memberCode ? (tdIds.get(s.memberCode) ?? null) : null }));
    for (const batch of chunks(rows, 200)) await tx.insert(debateSpeeches).values(batch);
  });
}

/** Link rows stored before their TD was in `tds` (or re-link after a roster change). */
export async function relinkTds(database: Db = db): Promise<void> {
  await database.execute(sql`
    update politics.division_votes v set td_id = t.id
    from politics.tds t
    where t.member_code = v.member_code and v.td_id is distinct from t.id`);
  await database.execute(sql`
    update politics.debate_speeches s set td_id = t.id
    from politics.tds t
    where t.member_code = s.member_code and s.td_id is distinct from t.id`);
  for (const table of ['committee_memberships', 'committee_attendance', 'bill_sponsors', 'question_counts']) {
    await database.execute(sql.raw(`
      update politics.${table} r set td_id = t.id
      from politics.tds t
      where t.member_code = r.member_code and r.td_id is distinct from t.id`));
  }
}

/** The roster's profile details that live on `tds`: current offices and committee names. */
export async function updateRosterDetails(
  rows: Array<{ memberCode: string; offices: Array<{ title: string; since: string | null }>; committees: string[] }>,
  database: Db = db,
): Promise<void> {
  await database.transaction(async (tx) => {
    for (const r of rows) {
      await tx
        .update(tds)
        .set({ offices: r.offices.map((o) => (o.since ? { title: o.title, since: o.since } : { title: o.title })), committees: r.committees })
        .where(eq(tds.memberCode, r.memberCode));
    }
  });
}

/**
 * Recompute every active TD's counts inside their own membership window.
 * `windows` comes from the roster: member code → { since, presiding }.
 */
export async function recomputeStats(
  windows: Map<string, { memberSince: string; isPresiding: boolean }>,
  database: Db = db,
): Promise<number> {
  const active = await database.select({ id: tds.id, code: tds.memberCode }).from(tds).where(eq(tds.isActive, true));
  const rows = active
    .filter((t) => t.code && windows.has(t.code))
    .map((t) => ({ tdId: t.id, ...windows.get(t.code as string)! }));
  if (rows.length === 0) return 0;

  await database.transaction(async (tx) => {
    // TDs no longer active keep no stats row; their votes and speeches stay.
    await tx.delete(tdParliamentStats);
    await tx.insert(tdParliamentStats).values(
      rows.map((r) => ({ ...r, divisionsEligible: 0, votesCast: 0, sittingDays: 0, sectionsSpoken: 0, speeches: 0 })),
    );
    await tx.execute(sql`
      update politics.td_parliament_stats s set
        divisions_eligible = (select count(*) from politics.divisions d where d.date >= s.member_since),
        votes_cast = (select count(*) from politics.division_votes v join politics.divisions d on d.id = v.division_id
                      where v.td_id = s.td_id and d.date >= s.member_since),
        sitting_days = (select count(distinct x.date) from politics.debate_sections x where x.date >= s.member_since),
        sections_spoken = (select count(distinct p.section_id) from politics.debate_speeches p
                           where p.td_id = s.td_id and not p.is_presiding and p.date >= s.member_since),
        speeches = (select count(*) from politics.debate_speeches p
                    where p.td_id = s.td_id and not p.is_presiding and p.date >= s.member_since),
        updated_at = now()`);
  });
  return rows.length;
}

export async function allStats(database: Db = db): Promise<TdParliamentStatsRow[]> {
  return database.select().from(tdParliamentStats);
}

export interface FeedState {
  throughDate: string | null;
  failures: Record<string, number>;
}

export async function getSyncState(feed: string, database: Db = db): Promise<FeedState> {
  const [row] = await database.select().from(parliamentSyncState).where(eq(parliamentSyncState.feed, feed));
  return { throughDate: row?.throughDate ?? null, failures: row?.failures ?? {} };
}

/** Record a run. A NULL `throughDate` keeps the stored one; `failures` replaces the stored map when given. */
export async function setSyncState(
  feed: string,
  throughDate: string | null,
  lastResult: string,
  failures?: Record<string, number>,
  database: Db = db,
): Promise<void> {
  const now = new Date();
  await database
    .insert(parliamentSyncState)
    .values({ feed, throughDate, lastResult, lastRunAt: now, failures: failures ?? {} })
    .onConflictDoUpdate({
      target: parliamentSyncState.feed,
      set: {
        throughDate: sql`coalesce(excluded.through_date, ${parliamentSyncState.throughDate})`,
        lastResult,
        lastRunAt: now,
        ...(failures ? { failures } : {}),
      },
    });
}

export async function syncStatus(database: Db = db) {
  const rows = await database.select().from(parliamentSyncState).orderBy(asc(parliamentSyncState.feed));
  return rows.map((r) => ({
    feed: r.feed,
    throughDate: r.throughDate,
    lastRunAt: r.lastRunAt.toISOString(),
    lastResult: r.lastResult,
    failures: r.failures,
  }));
}

/** member code → question totals currently on `tds`, kept when this run's counts are incomplete. */
export async function storedQuestionCounts(database: Db = db): Promise<Map<string, { oral: number | null; written: number | null }>> {
  const rows = await database
    .select({ code: tds.memberCode, oral: tds.questionCountOral, written: tds.questionCountWritten })
    .from(tds)
    .where(isNotNull(tds.memberCode));
  return new Map(rows.map((r) => [r.code as string, { oral: r.oral, written: r.written }]));
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function partyVoteRows(party: string | null, database: Db): Promise<PartyVoteRow[]> {
  const rows = await database
    .select({ divisionId: divisionVotes.divisionId, party: tds.party, vote: divisionVotes.vote, n: count() })
    .from(divisionVotes)
    .innerJoin(tds, eq(tds.id, divisionVotes.tdId))
    .where(party === null ? isNotNull(tds.party) : eq(tds.party, party))
    .groupBy(divisionVotes.divisionId, tds.party, divisionVotes.vote);
  return rows.map((r) => ({ divisionId: r.divisionId, party: r.party as string, vote: r.vote, n: Number(r.n) }));
}

/**
 * How a TD voted, newest first, each against their party's majority.
 * `divisionId` narrows it to one division ("did TD X vote for Y"); the pledges area uses this.
 */
export async function votesOf(
  tdId: number,
  opts: { limit?: number; againstParty?: boolean; divisionId?: string } = {},
  database: Db = db,
): Promise<TdVote[]> {
  const [td] = await database.select({ party: tds.party }).from(tds).where(eq(tds.id, tdId));
  if (!td) return [];
  const rows = await database
    .select({
      divisionId: divisions.id,
      date: divisions.date,
      subject: divisions.subject,
      debateTitle: divisions.debateTitle,
      outcome: divisions.outcome,
      vote: divisionVotes.vote,
    })
    .from(divisionVotes)
    .innerJoin(divisions, eq(divisions.id, divisionVotes.divisionId))
    .where(and(eq(divisionVotes.tdId, tdId), opts.divisionId ? eq(divisions.id, opts.divisionId) : undefined))
    .orderBy(desc(divisions.date), desc(divisions.heldAt), desc(divisions.id));

  const majorities = td.party && td.party !== INDEPENDENT ? partyMajorities(await partyVoteRows(td.party, database)) : new Map();
  let out: TdVote[] = rows.map((r) => {
    const partyMajority = majorityFor(majorities, r.divisionId, td.party);
    return { ...r, partyMajority, withParty: partyMajority === null ? null : r.vote === partyMajority };
  });
  if (opts.againstParty) out = out.filter((v) => v.withParty === false);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export async function tdSummary(tdId: number, database: Db = db) {
  const [row] = await database
    .select({ td: tds, stats: tdParliamentStats })
    .from(tds)
    .leftJoin(tdParliamentStats, eq(tdParliamentStats.tdId, tds.id))
    .where(eq(tds.id, tdId));
  if (!row) return null;
  const [votes, billsFeed, billCount] = await Promise.all([
    votesOf(tdId, {}, database),
    getSyncState('bills', database),
    countBillsSponsored(tdId, database),
  ]);
  // Before the bills feed has run once, zero bills would read as "sponsored none".
  const billsSponsored = billsFeed.throughDate ? billCount : null;
  const { td, stats } = row;
  const eligible = stats?.committeeSittingsEligible ?? null;
  const attended = stats?.committeeSittingsAttended ?? null;
  return {
    tdId,
    memberSince: stats?.memberSince ?? null,
    isPresiding: stats?.isPresiding ?? false,
    attendancePct: td.attendancePct,
    votesCast: stats?.votesCast ?? null,
    divisionsEligible: stats?.divisionsEligible ?? null,
    questionsOral: td.questionCountOral,
    questionsWritten: td.questionCountWritten,
    sectionsSpoken: stats?.sectionsSpoken ?? null,
    sittingDays: stats?.sittingDays ?? null,
    speeches: stats?.speeches ?? null,
    partyLinePct: partyLinePct(votes),
    votesAgainstParty: votes.some((v) => v.partyMajority !== null) ? votes.filter((v) => v.withParty === false).length : null,
    offices: (td.offices ?? []).map((o) => ({ title: o.title, since: o.since ?? null })),
    committeeSittingsEligible: eligible,
    committeeSittingsAttended: attended,
    committeeAttendancePct: eligible === null || attended === null ? null : committeeAttendancePct(attended, eligible),
    billsSponsored,
  };
}

export async function tdDebates(tdId: number, limit: number, database: Db = db): Promise<TdDebateContribution[]> {
  const rows = await database
    .select({
      sectionId: debateSections.id,
      date: debateSections.date,
      title: debateSections.title,
      speeches: count(),
      words: sql<number>`sum(${debateSpeeches.wordCount})::int`,
      excerpt: sql<string>`left((array_agg(${debateSpeeches.text} order by ${debateSpeeches.position}))[1], 300)`,
    })
    .from(debateSpeeches)
    .innerJoin(debateSections, eq(debateSections.id, debateSpeeches.sectionId))
    .where(and(eq(debateSpeeches.tdId, tdId), eq(debateSpeeches.isPresiding, false)))
    .groupBy(debateSections.id, debateSections.date, debateSections.title)
    .orderBy(desc(debateSections.date), desc(debateSections.id))
    .limit(limit);
  return rows.map((r) => ({ ...r, speeches: Number(r.speeches), words: Number(r.words) }));
}

const divisionSummaryCols = {
  id: divisions.id,
  date: divisions.date,
  subject: divisions.subject,
  debateTitle: divisions.debateTitle,
  outcome: divisions.outcome,
  isBill: divisions.isBill,
  taCount: divisions.taCount,
  nilCount: divisions.nilCount,
  staonCount: divisions.staonCount,
};

export async function listDivisions(limit: number, offset: number, database: Db = db): Promise<{ rows: DivisionSummary[]; total: number }> {
  const [rows, [{ n }]] = await Promise.all([
    database.select(divisionSummaryCols).from(divisions).orderBy(desc(divisions.date), desc(divisions.heldAt), desc(divisions.id)).limit(limit).offset(offset),
    database.select({ n: count() }).from(divisions),
  ]);
  return { rows, total: Number(n) };
}

export async function divisionDetail(id: string, database: Db = db): Promise<DivisionDetail | null> {
  const [division] = await database.select({ ...divisionSummaryCols, uri: divisions.uri }).from(divisions).where(eq(divisions.id, id));
  if (!division) return null;
  const votes = await database
    .select({ memberCode: divisionVotes.memberCode, tdId: divisionVotes.tdId, name: tds.name, party: tds.party, vote: divisionVotes.vote })
    .from(divisionVotes)
    .leftJoin(tds, eq(tds.id, divisionVotes.tdId))
    .where(eq(divisionVotes.divisionId, id))
    .orderBy(asc(tds.name), asc(divisionVotes.memberCode));

  const byParty = new Map<string, { party: string; ta: number; nil: number; staon: number }>();
  for (const v of votes) {
    // A voter not in `tds` (e.g. a TD who has since left) is not an Independent.
    const party = v.tdId === null ? NOT_IN_ROSTER : (v.party ?? INDEPENDENT);
    const row = byParty.get(party) ?? { party, ta: 0, nil: 0, staon: 0 };
    row[v.vote]++;
    byParty.set(party, row);
  }
  return {
    ...division,
    votes,
    byParty: Array.from(byParty.values()).sort((a, b) => b.ta + b.nil + b.staon - (a.ta + a.nil + a.staon) || a.party.localeCompare(b.party)),
  };
}

export async function listDebates(limit: number, offset: number, database: Db = db): Promise<{ rows: DebateSectionSummary[]; total: number }> {
  const [rows, [{ n }]] = await Promise.all([
    database
      .select({
        id: debateSections.id,
        date: debateSections.date,
        title: debateSections.title,
        speechCount: debateSections.speechCount,
        // Qualified by hand: Drizzle renders a column inside select-list SQL unqualified, and a
        // bare "id" here resolves to the subquery's own table and always counts 0.
        speakerCount: sql<number>`(select count(distinct p.member_code)::int from politics.debate_speeches p
                                   where p.section_id = "debate_sections"."id" and not p.is_presiding)`,
      })
      .from(debateSections)
      .orderBy(desc(debateSections.date), desc(debateSections.speechCount), asc(debateSections.id))
      .limit(limit)
      .offset(offset),
    database.select({ n: count() }).from(debateSections),
  ]);
  return { rows: rows.map((r) => ({ ...r, speakerCount: Number(r.speakerCount) })), total: Number(n) };
}

export async function debateDetail(id: string, database: Db = db): Promise<DebateSectionDetail | null> {
  const [section] = await database.select().from(debateSections).where(eq(debateSections.id, id));
  if (!section) return null;
  const speakers = await database
    .select({
      tdId: debateSpeeches.tdId,
      memberCode: debateSpeeches.memberCode,
      name: tds.name,
      party: tds.party,
      speeches: count(),
      words: sql<number>`sum(${debateSpeeches.wordCount})::int`,
    })
    .from(debateSpeeches)
    .leftJoin(tds, eq(tds.id, debateSpeeches.tdId))
    .where(and(eq(debateSpeeches.sectionId, id), eq(debateSpeeches.isPresiding, false)))
    .groupBy(debateSpeeches.tdId, debateSpeeches.memberCode, tds.name, tds.party)
    .orderBy(desc(sql`sum(${debateSpeeches.wordCount})`));
  return {
    id: section.id,
    date: section.date,
    title: section.title,
    speechCount: section.speechCount,
    speakerCount: speakers.filter((s) => s.memberCode).length,
    speakers: speakers.map((s) => ({ ...s, speeches: Number(s.speeches), words: Number(s.words) })),
  };
}

export async function leaderboard(
  metric: LeaderboardMetric,
  order: 'asc' | 'desc',
  limit: number,
  database: Db = db,
): Promise<LeaderboardEntry[]> {
  const value = {
    attendance: sql<number>`${tds.attendancePct}`,
    participation: sql<number>`round(${tdParliamentStats.sectionsSpoken} * 10.0 / nullif(${tdParliamentStats.sittingDays}, 0), 1)`,
    questions: sql<number>`(${tds.questionCountOral} + ${tds.questionCountWritten})`,
    committees: sql<number>`round(${tdParliamentStats.committeeSittingsAttended} * 100.0 / nullif(${tdParliamentStats.committeeSittingsEligible}, 0), 1)`,
  }[metric];
  const measurable = {
    attendance: sql`${tds.attendancePct} is not null`,
    participation: sql`not ${tdParliamentStats.isPresiding} and ${tdParliamentStats.sittingDays} >= ${MIN_SITTING_DAYS}`,
    questions: sql`${tds.questionCountOral} is not null and ${tds.questionCountWritten} is not null`,
    committees: sql`${tdParliamentStats.committeeSittingsEligible} >= ${MIN_COMMITTEE_SITTINGS}`,
  }[metric];
  const rows = await database
    .select({ tdId: tds.id, name: tds.name, party: tds.party, constituency: tds.constituency, imageUrl: tds.imageUrl, value })
    .from(tds)
    .leftJoin(tdParliamentStats, eq(tdParliamentStats.tdId, tds.id))
    .where(and(eq(tds.isActive, true), measurable))
    .orderBy(order === 'asc' ? asc(value) : desc(value), asc(tds.name))
    .limit(limit);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function parties(database: Db = db): Promise<PartyParliamentSummary[]> {
  const members = await database
    .select({
      party: tds.party,
      attendancePct: tds.attendancePct,
      sectionsSpoken: tdParliamentStats.sectionsSpoken,
      isPresiding: tdParliamentStats.isPresiding,
      committeeEligible: tdParliamentStats.committeeSittingsEligible,
      committeeAttended: tdParliamentStats.committeeSittingsAttended,
    })
    .from(tds)
    .leftJoin(tdParliamentStats, eq(tdParliamentStats.tdId, tds.id))
    .where(eq(tds.isActive, true));
  const pv = await partyVoteRows(null, database);
  const majorities = partyMajorities(pv);

  // Cohesion: of every vote a party's members cast, the share that matched its majority.
  const cohesion = new Map<string, { with: number; total: number }>();
  for (const r of pv) {
    const m = majorityFor(majorities, r.divisionId, r.party);
    if (m === null) continue;
    const c = cohesion.get(r.party) ?? { with: 0, total: 0 };
    c.total += r.n;
    if (r.vote === m) c.with += r.n;
    cohesion.set(r.party, c);
  }

  const groups = new Map<string, typeof members>();
  for (const m of members) {
    const party = m.party ?? INDEPENDENT;
    groups.set(party, [...(groups.get(party) ?? []), m]);
  }
  const avg = (xs: Array<number | null>) => {
    const present = xs.filter((x): x is number => x !== null);
    return present.length ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10 : null;
  };
  return Array.from(groups.entries())
    .map(([party, ms]) => {
      const c = cohesion.get(party);
      return {
        party,
        members: ms.length,
        avgAttendancePct: avg(ms.map((m) => m.attendancePct)),
        partyLinePct: c && c.total ? Math.round((c.with / c.total) * 1000) / 10 : null,
        avgSectionsSpoken: avg(ms.filter((m) => !m.isPresiding).map((m) => m.sectionsSpoken ?? null)),
        avgCommitteeAttendancePct: avg(
          ms.map((m) => (m.committeeEligible === null || m.committeeAttended === null ? null : committeeAttendancePct(m.committeeAttended, m.committeeEligible))),
        ),
      };
    })
    .sort((a, b) => b.members - a.members || a.party.localeCompare(b.party));
}

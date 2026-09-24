/**
 * One incremental parliament sync. The only writer of the parliament tables.
 *
 *   1. roster     → politics.tds (insert / update / deactivate; never delete)
 *   2. divisions  → divisions, division_votes
 *   3. debates    → debate_sections, debate_speeches (one transcript per sitting day)
 *   4. relink rows stored before their TD existed
 *   5. per-TD counts inside each TD's own membership window
 *   6. question counts, then the scoring inputs, then recalculateAll()
 *
 * Each feed resumes from the last date it fully ingested, re-reading an overlap window
 * because the Oireachtas corrects and back-publishes records.
 */
import { recalculateAll, repository as scoring } from '../scoring';
import { memberImageUrl, type TdSeed } from '../scoring/tdSync';
import { OireachtasClient, type RosterMember } from './client';
import { attendancePct } from './metrics';
import { parseDivision, parseTranscript, type ParsedDivision } from './parse';
import * as repo from './repository';
import { isoDate, resumePoint, startDate } from './window';

/** Runs a failing sitting day is retried for before it is left for a person to look at. */
export const MAX_DAY_ATTEMPTS = 10;
/** Politeness gap between per-TD and per-day requests. */
const REQUEST_GAP_MS = 250;

export interface SyncOptions {
  /** Re-ingest from this date (YYYY-MM-DD) instead of resuming. */
  since?: string;
  client?: OireachtasClient;
  today?: string;
  log?: (line: string) => void;
}

export interface SyncSummary {
  roster: { members: number; inserted: number; updated: number; deactivated: number };
  divisions: { from: string; to: string; ingested: number };
  /** `failedDays`: days that failed in THIS run (the stored map has every open failure). */
  debates: { from: string; to: string; days: number; failedDays: string[]; sections: number; speeches: number };
  statsRows: number;
  questionsFetched: number;
  scoringRowsWritten: number;
}

export function rosterToSeeds(members: RosterMember[]): TdSeed[] {
  return members.map((m) => ({
    name: m.fullName,
    party: m.party,
    constituency: m.constituency,
    memberCode: m.memberCode,
    imageUrl: memberImageUrl(m.memberCode),
  }));
}


const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thrown when a sync is already running in this process (scheduler and admin trigger share it). */
export class SyncAlreadyRunning extends Error {}
let inFlight = false;

export function isSyncRunning(): boolean {
  return inFlight;
}

export async function runSync(options: SyncOptions = {}): Promise<SyncSummary> {
  if (inFlight) throw new SyncAlreadyRunning('A parliament sync is already running');
  inFlight = true;
  try {
    return await syncOnce(options);
  } finally {
    inFlight = false;
  }
}

async function syncOnce(options: SyncOptions): Promise<SyncSummary> {
  const client = options.client ?? new OireachtasClient();
  const today = options.today ?? isoDate(new Date());
  const log = options.log ?? ((line: string) => console.log(line));

  // 1. Roster. An empty roster means the API failed, not that the Dáil emptied.
  const roster = await client.roster();
  if (roster.length === 0) throw new Error('The Oireachtas roster came back empty; refusing to sync.');
  const rosterResult = await scoring.syncTds(rosterToSeeds(roster));
  await repo.setSyncState('roster', today, `${roster.length} members`);
  log(`Roster: ${roster.length} members (+${rosterResult.inserted} ~${rosterResult.updated} -${rosterResult.deactivated}).`);

  const dailStart = roster.map((m) => m.memberSince).sort()[0];
  const tdIds = await repo.tdIdsByMemberCode();

  // 2. Divisions: few enough (≈400 a term) to fetch the window in one go.
  const divState = await repo.getSyncState('divisions');
  const divFrom = startDate(options.since, divState.throughDate, dailStart);
  const parsed = (await client.divisions(divFrom, today)).map(parseDivision).filter((d): d is ParsedDivision => d !== null);
  await repo.upsertDivisions(parsed, tdIds);
  await repo.setSyncState('divisions', resumePoint(options.since, divState.throughDate, dailStart, today), `${parsed.length} divisions ${divFrom}..${today}`);
  log(`Divisions: ${parsed.length} (${divFrom}..${today}).`);

  // 3. Debates, one transcript per sitting day. A day that fails (or is listed before its
  //    transcript exists) is recorded and retried on later runs; it never blocks the others.
  const debState = await repo.getSyncState('debates');
  const debFrom = startDate(options.since, debState.throughDate, dailStart);
  const failures = { ...debState.failures };
  const days = await client.debateDays(debFrom, today);
  for (const [date, attempts] of Object.entries(failures)) {
    if (date < debFrom && attempts < MAX_DAY_ATTEMPTS) days.push(...(await client.debateDays(date, date)));
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  const failedDays: string[] = [];
  let sections = 0;
  let speeches = 0;
  for (const day of days) {
    try {
      if (!day.xmlUri) throw new Error('listed, but no transcript published yet');
      const transcript = parseTranscript(await client.transcript(day.xmlUri), day.date);
      await repo.replaceDebateDay(day.date, transcript.sections, transcript.speeches, tdIds);
      sections += transcript.sections.length;
      speeches += transcript.speeches.length;
      delete failures[day.date];
    } catch (error) {
      failures[day.date] = (failures[day.date] ?? 0) + 1;
      failedDays.push(day.date);
      log(`Debates: ${day.date} failed, attempt ${failures[day.date]} of ${MAX_DAY_ATTEMPTS} (${error instanceof Error ? error.message : String(error)}).`);
    }
    await pause(REQUEST_GAP_MS);
  }
  await repo.setSyncState(
    'debates',
    resumePoint(options.since, debState.throughDate, dailStart, today),
    `${days.length} days ${debFrom}..${today}${failedDays.length ? `, ${failedDays.length} failed` : ''}`,
    failures,
  );
  log(`Debates: ${days.length} sitting days, ${sections} sections, ${speeches} speeches.`);

  // 4–5. Link and count.
  await repo.relinkTds();
  const windows = new Map(roster.map((m) => [m.memberCode, { memberSince: m.memberSince, isPresiding: m.isPresiding }]));
  const statsRows = await repo.recomputeStats(windows);

  // 6. Questions, then the scoring inputs. A failed fetch keeps the last good counts
  //    (NULL if there never were any); it never reads as 0.
  const stored = await repo.storedQuestionCounts();
  const questions = new Map<string, { oral: number | null; written: number | null }>();
  let questionsFetched = 0;
  for (const m of roster) {
    try {
      questions.set(m.memberCode, await client.questionCounts(m.memberCode, m.memberSince, today));
      questionsFetched++;
    } catch (error) {
      const last = stored.get(m.memberCode);
      if (last) questions.set(m.memberCode, last);
      log(`Questions: ${m.memberCode} failed (${error instanceof Error ? error.message : String(error)}); keeping the last counts.`);
    }
    await pause(REQUEST_GAP_MS);
  }

  const stats = new Map((await repo.allStats()).map((s) => [s.tdId, s]));
  const written = await scoring.updateParliamentaryActivity(
    roster.map((m) => {
      const tdId = tdIds.get(m.memberCode);
      const s = tdId === undefined ? undefined : stats.get(tdId);
      const q = questions.get(m.memberCode);
      return {
        memberCode: m.memberCode,
        questionsOral: q?.oral ?? null,
        questionsWritten: q?.written ?? null,
        attendancePct: s ? attendancePct(s.votesCast, s.divisionsEligible, s.isPresiding) : null,
      };
    }),
  );
  await recalculateAll();

  return {
    roster: { members: roster.length, ...rosterResult },
    divisions: { from: divFrom, to: today, ingested: parsed.length },
    debates: { from: debFrom, to: today, days: days.length, failedDays, sections, speeches },
    statsRows,
    questionsFetched,
    scoringRowsWritten: written,
  };
}

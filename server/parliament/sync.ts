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

/** Days re-read before the resume point. Transcripts can appear a week or more late. */
export const OVERLAP_DAYS = 14;
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
  debates: { from: string; to: string; days: number; failedDay: string | null; sections: number; speeches: number };
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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/** Where a feed starts: an explicit `since`, else the resume point minus the overlap, else the Dáil's first day. */
export function startDate(since: string | undefined, throughDate: string | null, dailStart: string): string {
  if (since) return since;
  if (!throughDate) return dailStart;
  const resume = addDays(throughDate, -OVERLAP_DAYS);
  return resume < dailStart ? dailStart : resume;
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
  const divFrom = startDate(options.since, await repo.getSyncState('divisions'), dailStart);
  const parsed = (await client.divisions(divFrom, today)).map(parseDivision).filter((d): d is ParsedDivision => d !== null);
  await repo.upsertDivisions(parsed, tdIds);
  await repo.setSyncState('divisions', today, `${parsed.length} divisions ${divFrom}..${today}`);
  log(`Divisions: ${parsed.length} (${divFrom}..${today}).`);

  // 3. Debates, oldest day first; stop at the first failure so the resume point never skips a day.
  const debFrom = startDate(options.since, await repo.getSyncState('debates'), dailStart);
  const days = (await client.debateDays(debFrom, today)).sort((a, b) => a.date.localeCompare(b.date));
  let throughDate: string | null = null;
  let failedDay: string | null = null;
  let sections = 0;
  let speeches = 0;
  for (const day of days) {
    try {
      const transcript = parseTranscript(await client.transcript(day.xmlUri), day.date);
      await repo.replaceDebateDay(day.date, transcript.sections, transcript.speeches, tdIds);
      sections += transcript.sections.length;
      speeches += transcript.speeches.length;
      throughDate = day.date;
    } catch (error) {
      failedDay = day.date;
      log(`Debates: ${day.date} failed (${error instanceof Error ? error.message : String(error)}); resuming there next run.`);
      break;
    }
    await pause(REQUEST_GAP_MS);
  }
  // No failure: everything up to today is in, including days with no sitting.
  const debatesThrough = failedDay ? (throughDate ?? null) : today;
  await repo.setSyncState('debates', debatesThrough, failedDay ? `failed on ${failedDay}` : `${days.length} days ${debFrom}..${today}`);
  log(`Debates: ${days.length} sitting days, ${sections} sections, ${speeches} speeches.`);

  // 4–5. Link and count.
  await repo.relinkTds();
  const windows = new Map(roster.map((m) => [m.memberCode, { memberSince: m.memberSince, isPresiding: m.isPresiding }]));
  const statsRows = await repo.recomputeStats(windows);

  // 6. Questions, then the scoring inputs. A failed count stays NULL; it never reads as 0.
  const questions = new Map<string, { oral: number; written: number }>();
  for (const m of roster) {
    try {
      questions.set(m.memberCode, await client.questionCounts(m.memberCode, m.memberSince, today));
    } catch (error) {
      log(`Questions: ${m.memberCode} failed (${error instanceof Error ? error.message : String(error)}).`);
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
    debates: { from: debFrom, to: today, days: days.length, failedDay, sections, speeches },
    statsRows,
    questionsFetched: questions.size,
    scoringRowsWritten: written,
  };
}

/**
 * One incremental parliament sync. The only writer of the parliament tables.
 *
 *   1. roster      → politics.tds (insert / update / deactivate; never delete), offices,
 *                    committee memberships
 *   2. divisions   → divisions, division_votes
 *   3. debates     → debate_sections, debate_speeches (one transcript per sitting day)
 *   4. committees  → committee_sittings, committee_attendance (the roll call of each sitting)
 *   5. bills       → bills, bill_sponsors, bill_stages, bill_debates (the whole term)
 *   6. questions   → question_counts (per TD, month, department, type)
 *   7. relink rows stored before their TD existed; per-TD counts in each TD's own window
 *   8. the scoring inputs, then recalculateAll()
 *
 * Dated feeds resume from the last date they fully ingested, re-reading an overlap window
 * because the Oireachtas corrects and back-publishes records. A unit that fails (a day, or
 * a month of questions) is recorded and retried on later runs; it never blocks the others.
 */
import { recalculateAll, repository as scoring } from '../scoring';
import { memberImageUrl, type TdSeed } from '../scoring/tdSync';
import { OireachtasClient, type RosterMember } from './client';
import { attendancePct } from './metrics';
import {
  countQuestions,
  parseBill,
  parseDivision,
  parseRollCall,
  parseTranscript,
  type ParsedBill,
  type ParsedDivision,
  type ParsedSpeech,
} from './parse';
import * as repo from './repository';
import { withDeadlockRetry } from './repo/util';
import { isoDate, monthEnd, monthsBetween, resumePoint, startDate } from './window';

/** Runs a failing unit (a day, a month) is retried for before it is left for a person to look at. */
export const MAX_DAY_ATTEMPTS = 10;
/** Politeness gap between per-day and per-month requests. */
const REQUEST_GAP_MS = 250;

export interface SyncOptions {
  /** Re-ingest from this date (YYYY-MM-DD) instead of resuming. */
  since?: string;
  client?: OireachtasClient;
  today?: string;
  log?: (line: string) => void;
}

/** `failed*`: units that failed in THIS run (the stored map has every open failure). */
export interface SyncSummary {
  roster: { members: number; inserted: number; updated: number; deactivated: number; committeeMemberships: number };
  divisions: { from: string; to: string; ingested: number };
  debates: { from: string; to: string; days: number; failedDays: string[]; sections: number; speeches: number };
  committees: { from: string; to: string; days: number; failedDays: string[]; sittings: number };
  bills: { ingested: number };
  questions: { from: string; to: string; months: number; failedMonths: string[]; questions: number };
  statsRows: number;
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
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Ingest keyed units (days or months) oldest first. A unit that throws is counted in
 * `failures` and the rest carry on; a unit that succeeds clears its entry.
 */
async function ingestUnits(
  label: string,
  keys: string[],
  failures: Record<string, number>,
  ingest: (key: string) => Promise<void>,
  log: (line: string) => void,
): Promise<string[]> {
  const failed: string[] = [];
  for (const key of Array.from(new Set(keys)).sort()) {
    try {
      await ingest(key);
      delete failures[key];
    } catch (error) {
      failures[key] = (failures[key] ?? 0) + 1;
      failed.push(key);
      log(`${label}: ${key} failed, attempt ${failures[key]} of ${MAX_DAY_ATTEMPTS} (${message(error)}).`);
    }
    await pause(REQUEST_GAP_MS);
  }
  return failed;
}

/** Earlier failed units, outside the normal window, that still have attempts left. */
function retryable(failures: Record<string, number>, before: string): string[] {
  return Object.entries(failures)
    .filter(([key, attempts]) => key < before && attempts < MAX_DAY_ATTEMPTS)
    .map(([key]) => key);
}

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
  const tdIds = await repo.tdIdsByMemberCode();
  await repo.updateRosterDetails(
    roster.map((m) => ({ memberCode: m.memberCode, offices: m.offices, committees: repo.currentCommitteeNames(m) })),
  );
  const committeeMemberships = await repo.replaceCommitteeMemberships(roster, tdIds);
  await repo.setSyncState('roster', today, `${roster.length} members, ${committeeMemberships} committee memberships`);
  log(`Roster: ${roster.length} members (+${rosterResult.inserted} ~${rosterResult.updated} -${rosterResult.deactivated}), ${committeeMemberships} committee memberships.`);

  const dailStart = roster.map((m) => m.memberSince).sort()[0];

  // 2. Divisions: few enough (≈400 a term) to fetch the window in one go.
  const divState = await repo.getSyncState('divisions');
  const divFrom = startDate(options.since, divState.throughDate, dailStart);
  const parsed = (await client.divisions(divFrom, today)).map(parseDivision).filter((d): d is ParsedDivision => d !== null);
  await repo.upsertDivisions(parsed, tdIds);
  await repo.setSyncState('divisions', resumePoint(options.since, divState.throughDate, dailStart, today), `${parsed.length} divisions ${divFrom}..${today}`);
  log(`Divisions: ${parsed.length} (${divFrom}..${today}).`);

  // 3. Dáil debates, grouped by sitting day.
  const debState = await repo.getSyncState('debates');
  const debFrom = startDate(options.since, debState.throughDate, dailStart);
  const debFailures = { ...debState.failures };
  const listed = await client.debateDays(debFrom, today);
  for (const date of retryable(debFailures, debFrom)) listed.push(...(await client.debateDays(date, date)));
  const byDay = new Map<string, Array<string | null>>();
  for (const d of listed) byDay.set(d.date, [...(byDay.get(d.date) ?? []), d.xmlUri]);
  let sections = 0;
  let speeches = 0;
  const failedDays = await ingestUnits('Debates', Array.from(byDay.keys()), debFailures, async (date) => {
    const daySections: Parameters<typeof repo.replaceDebateDay>[1] = [];
    const daySpeeches: ParsedSpeech[] = [];
    for (const xmlUri of byDay.get(date) ?? []) {
      if (!xmlUri) throw new Error('listed, but no transcript published yet');
      const t = parseTranscript(await client.transcript(xmlUri), date);
      daySections.push(...t.sections);
      daySpeeches.push(...t.speeches);
    }
    await repo.replaceDebateDay(date, daySections, daySpeeches, tdIds);
    sections += daySections.length;
    speeches += daySpeeches.length;
  }, log);
  await repo.setSyncState(
    'debates',
    resumePoint(options.since, debState.throughDate, dailStart, today),
    `${byDay.size} days ${debFrom}..${today}${failedDays.length ? `, ${failedDays.length} failed` : ''}`,
    debFailures,
  );
  log(`Debates: ${byDay.size} sitting days, ${sections} sections, ${speeches} speeches.`);

  // 4. Committee sittings: only the roll call is read from each transcript.
  const comState = await repo.getSyncState('committees');
  const comFrom = startDate(options.since, comState.throughDate, dailStart);
  const comFailures = { ...comState.failures };
  const comListed = await client.committeeSittings(comFrom, today);
  for (const date of retryable(comFailures, comFrom)) comListed.push(...(await client.committeeSittings(date, date)));
  const comByDay = new Map<string, typeof comListed>();
  for (const s of comListed) comByDay.set(s.date, [...(comByDay.get(s.date) ?? []), s]);
  let committeeSittings = 0;
  const failedCommitteeDays = await ingestUnits('Committees', Array.from(comByDay.keys()), comFailures, async (date) => {
    for (const sitting of comByDay.get(date) ?? []) {
      if (!sitting.xmlUri) throw new Error(`${sitting.committeeName}: listed, but no transcript published yet`);
      await repo.replaceCommitteeSitting(sitting, parseRollCall(await client.transcript(sitting.xmlUri)), tdIds);
      committeeSittings++;
    }
  }, log);
  await repo.setSyncState(
    'committees',
    resumePoint(options.since, comState.throughDate, dailStart, today),
    `${committeeSittings} sittings ${comFrom}..${today}${failedCommitteeDays.length ? `, ${failedCommitteeDays.length} days failed` : ''}`,
    comFailures,
  );
  log(`Committees: ${committeeSittings} sittings on ${comByDay.size} days.`);

  // 5. Bills: the whole term is a page or two, so it is refreshed in full every run.
  const billsParsed = (await client.bills(dailStart)).map(parseBill).filter((b): b is ParsedBill => b !== null);
  await repo.replaceBills(billsParsed, tdIds);
  await repo.setSyncState('bills', today, `${billsParsed.length} bills since ${dailStart}`);
  log(`Bills: ${billsParsed.length}.`);

  // 6. Questions, counted per month. A failed month keeps its previous counts.
  const qState = await repo.getSyncState('questions');
  const qFrom = startDate(options.since, qState.throughDate, dailStart);
  const qFailures = { ...qState.failures };
  const window = monthsBetween(qFrom, today);
  const months = [...window, ...retryable(qFailures, window[0])];
  let questions = 0;
  const failedMonths = await ingestUnits('Questions', months, qFailures, async (month) => {
    const from = month < dailStart ? dailStart : month;
    const end = monthEnd(month);
    const raws = await client.questions(from, end > today ? today : end);
    await repo.replaceQuestionMonths([month], countQuestions(raws), tdIds);
    questions += raws.length;
  }, log);
  await repo.setSyncState(
    'questions',
    resumePoint(options.since, qState.throughDate, dailStart, today),
    `${questions} questions in ${months.length} months${failedMonths.length ? `, ${failedMonths.length} failed` : ''}`,
    qFailures,
  );
  log(`Questions: ${questions} in ${months.length} months.`);

  // 7. Link and count. Other writers (the scoring cron) touch the same rows, so the
  //    set-based steps retry on a deadlock instead of failing the whole run.
  await withDeadlockRetry(() => repo.relinkTds());
  const windows = new Map(roster.map((m) => [m.memberCode, { memberSince: m.memberSince, isPresiding: m.isPresiding }]));
  const statsRows = await withDeadlockRetry(() => repo.recomputeStats(windows));
  await withDeadlockRetry(() => repo.recomputeCommitteeStats());

  // 8. Scoring inputs. Question totals come from the counts above; while any month is
  //    still failing they would undercount, so the last written totals are kept instead.
  const complete = Object.keys(qFailures).length === 0 && (await repo.hasQuestionCounts());
  const totals = complete ? await repo.questionTotals(dailStart) : null;
  const stored = complete ? null : await repo.storedQuestionCounts();
  if (!complete) log('Questions: some months are missing, so question totals keep their last values.');
  const stats = new Map((await repo.allStats()).map((s) => [s.tdId, s]));
  const written = await withDeadlockRetry(() =>
    scoring.updateParliamentaryActivity(
      roster.map((m) => {
        const tdId = tdIds.get(m.memberCode);
        const s = tdId === undefined ? undefined : stats.get(tdId);
        const q = totals ? (totals.get(m.memberCode) ?? { oral: 0, written: 0 }) : stored?.get(m.memberCode);
        return {
          memberCode: m.memberCode,
          questionsOral: q?.oral ?? null,
          questionsWritten: q?.written ?? null,
          attendancePct: s ? attendancePct(s.votesCast, s.divisionsEligible, s.isPresiding) : null,
        };
      }),
    ),
  );
  await withDeadlockRetry(() => recalculateAll());

  return {
    roster: { members: roster.length, ...rosterResult, committeeMemberships },
    divisions: { from: divFrom, to: today, ingested: parsed.length },
    debates: { from: debFrom, to: today, days: byDay.size, failedDays, sections, speeches },
    committees: { from: comFrom, to: today, days: comByDay.size, failedDays: failedCommitteeDays, sittings: committeeSittings },
    bills: { ingested: billsParsed.length },
    questions: { from: qFrom, to: today, months: months.length, failedMonths, questions },
    statsRows,
    scoringRowsWritten: written,
  };
}

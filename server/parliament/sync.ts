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
 * A feed that fails outright (its listing call, say) is recorded in `failedFeeds` and the
 * later feeds still run, so one broken endpoint does not stop the rest of the data.
 */
import { recalculateAll, repository as scoring } from '../scoring';
import { memberImageUrl, type TdSeed } from '../scoring/tdSync';
import { OireachtasClient, type RosterMember } from './client';
import { DOCUMENTED_ABSENCES, validateAbsences } from './absences';
import { PARTY_LEADERS, validatePartyLeaders } from './partyLeaders';
import { syncAllowances, syncInterests, type DisclosureResult, type DisclosureSource } from './disclosures';
import { fetchGenders } from './sources/wikidata';
import { attendancePct, committeeAttendancePct } from './metrics';
import {
  countQuestions,
  parseBill,
  parseDivision,
  parseRollCall,
  parseTranscript,
  resolveRollCallNames,
  type ParsedBill,
  type ParsedDivision,
  type ParsedSpeech,
} from './parse';
import * as repo from './repository';
import { withDeadlockRetry } from './repo/util';
import { addDays, isoDate, monthEnd, monthsBetween, resumePoint, startDate } from './window';

/**
 * A failed sitting day is retried on every run until it is this old, then left in the
 * failure map for a person to look at. By age, not attempts: committee transcripts were
 * measured still unpublished 10 days after the sitting, and ten daily attempts gave up.
 */
export const RETRY_WINDOW_DAYS = 90;
/** Politeness gap between per-day and per-month requests. */
const REQUEST_GAP_MS = 250;

export interface SyncOptions {
  /** Re-ingest from this date (YYYY-MM-DD) instead of resuming. */
  since?: string;
  client?: OireachtasClient;
  /** Gender by member code (Wikidata by default; the API has none). */
  genders?: (memberCodes: string[]) => Promise<Map<string, string>>;
  /** The interests register and allowance PDFs (oireachtas.ie by default). */
  disclosures?: DisclosureSource;
  today?: string;
  log?: (line: string) => void;
}

export type SyncFeed = 'gender' | 'divisions' | 'debates' | 'committees' | 'bills' | 'questions' | 'interests' | 'allowances';

/** `failed*`: units that failed in THIS run (the stored map has every open failure). */
export interface SyncSummary {
  roster: { members: number; inserted: number; updated: number; deactivated: number; committeeMemberships: number };
  divisions: { from: string; to: string; ingested: number };
  debates: { from: string; to: string; days: number; failedDays: string[]; sections: number; speeches: number };
  committees: { from: string; to: string; days: number; failedDays: string[]; sittings: number; unresolvedSittings: number };
  bills: { ingested: number };
  questions: { from: string; to: string; months: number; failedMonths: string[]; questions: number; totalsComplete: boolean };
  /** New PDF files read this run; names that matched no current TD are listed, not stored. */
  interests: DisclosureResult;
  allowances: DisclosureResult;
  /** Feeds that failed as a whole in this run; their tables keep what they had. */
  failedFeeds: SyncFeed[];
  statsRows: number;
  scoringRowsWritten: number;
}

/** True when any part of the run failed: a whole feed, or a day or month inside one. */
export function syncHadFailures(s: SyncSummary): boolean {
  return (
    s.failedFeeds.length > 0 ||
    s.debates.failedDays.length > 0 ||
    s.committees.failedDays.length > 0 ||
    s.questions.failedMonths.length > 0
  );
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
      log(`${label}: ${key} failed, attempt ${failures[key]} (${message(error)}).`);
    }
    await pause(REQUEST_GAP_MS);
  }
  return failed;
}

/** Earlier failed units, outside the normal window, no older than `oldest` (YYYY-MM-DD). */
function retryable(failures: Record<string, number>, before: string, oldest: string): string[] {
  return Object.keys(failures).filter((key) => key < before && key >= oldest);
}

/** Group listed items by day, dropping repeats of the same key within a day. */
function groupByDay<T extends { date: string }>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.date}\u0000${keyOf(item)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.set(item.date, [...(out.get(item.date) ?? []), item]);
  }
  return out;
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
  const failedFeeds: SyncFeed[] = [];

  /** Run one feed; if it throws, record it and let the later feeds run. */
  async function feed(name: SyncFeed, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      failedFeeds.push(name);
      log(`${name}: the whole feed failed (${message(error)}); its tables keep their previous data.`);
    }
  }

  // 1. Roster. An empty roster means the API failed, not that the Dáil emptied. Every
  //    later step needs it, so a roster failure stops the run.
  const roster = await client.roster();
  if (roster.length === 0) throw new Error('The Oireachtas roster came back empty; refusing to sync.');
  const rosterResult = await scoring.syncTds(rosterToSeeds(roster));
  const tdIds = await repo.tdIdsByMemberCode();
  await repo.updateRosterDetails(
    roster.map((m) => ({ memberCode: m.memberCode, offices: m.offices, committees: repo.currentCommitteeNames(m) })),
  );
  const committeeMemberships = await repo.replaceCommitteeMemberships(roster, tdIds);
  // Offices and documented leave: why a TD was not expected to vote or ask questions.
  const offices = await repo.replaceOffices(roster, tdIds);
  await repo.replaceAbsences(validateAbsences(DOCUMENTED_ABSENCES), tdIds);
  await repo.replacePartyLeaders(validatePartyLeaders(PARTY_LEADERS), tdIds);
  await repo.setSyncState('roster', today, `${roster.length} members, ${committeeMemberships} committee memberships, ${offices} offices`);
  log(`Roster: ${roster.length} members (+${rosterResult.inserted} ~${rosterResult.updated} -${rosterResult.deactivated}), ${committeeMemberships} committee memberships, ${offices} offices, ${DOCUMENTED_ABSENCES.length} documented absences.`);

  const dailStart = roster.map((m) => m.memberSince).sort()[0];
  const oldestRetry = addDays(today, -RETRY_WINDOW_DAYS);

  // 1b. Gender, which the API leaves empty for every member.
  await feed('gender', async () => {
    const genders = await (options.genders ?? fetchGenders)(roster.map((m) => m.memberCode));
    const changed = await repo.updateGenders(genders);
    log(`Gender: ${genders.size} of ${roster.length} members known${changed ? `, ${changed} updated` : ''}.`);
  });

  // 2. Divisions: few enough (≈400 a term) to fetch the window in one go.
  const divisions: SyncSummary['divisions'] = { from: '', to: today, ingested: 0 };
  await feed('divisions', async () => {
    const state = await repo.getSyncState('divisions');
    divisions.from = startDate(options.since, state.throughDate, dailStart);
    const parsed = (await client.divisions(divisions.from, today)).map(parseDivision).filter((d): d is ParsedDivision => d !== null);
    await repo.upsertDivisions(parsed, tdIds);
    await repo.setSyncState('divisions', resumePoint(options.since, state.throughDate, dailStart, today), `${parsed.length} divisions ${divisions.from}..${today}`);
    divisions.ingested = parsed.length;
    log(`Divisions: ${parsed.length} (${divisions.from}..${today}).`);
  });

  // 3. Dáil debates, grouped by sitting day.
  const debates: SyncSummary['debates'] = { from: '', to: today, days: 0, failedDays: [], sections: 0, speeches: 0 };
  await feed('debates', async () => {
    const state = await repo.getSyncState('debates');
    debates.from = startDate(options.since, state.throughDate, dailStart);
    const failures = { ...state.failures };
    const listed = await client.debateDays(debates.from, today);
    for (const date of retryable(failures, debates.from, oldestRetry)) listed.push(...(await client.debateDays(date, date)));
    const byDay = groupByDay(listed, (d) => d.xmlUri ?? '');
    debates.days = byDay.size;
    debates.failedDays = await ingestUnits('Debates', Array.from(byDay.keys()), failures, async (date) => {
      const daySections: Parameters<typeof repo.replaceDebateDay>[1] = [];
      const daySpeeches: ParsedSpeech[] = [];
      for (const { xmlUri } of byDay.get(date) ?? []) {
        if (!xmlUri) throw new Error('listed, but no transcript published yet');
        const t = parseTranscript(await client.transcript(xmlUri), date);
        daySections.push(...t.sections);
        daySpeeches.push(...t.speeches);
      }
      await repo.replaceDebateDay(date, daySections, daySpeeches, tdIds);
      debates.sections += daySections.length;
      debates.speeches += daySpeeches.length;
    }, log);
    await repo.setSyncState(
      'debates',
      resumePoint(options.since, state.throughDate, dailStart, today),
      `${byDay.size} days ${debates.from}..${today}${debates.failedDays.length ? `, ${debates.failedDays.length} failed` : ''}`,
      failures,
    );
    log(`Debates: ${byDay.size} sitting days, ${debates.sections} sections, ${debates.speeches} speeches.`);
  });

  // 4. Committee sittings: only the roll call is read from each transcript. Roll-call names
  //    with no member reference are matched to the roster by name; a sitting with a name
  //    that still could be a TD is stored but not counted for attendance.
  const committees: SyncSummary['committees'] = { from: '', to: today, days: 0, failedDays: [], sittings: 0, unresolvedSittings: 0 };
  await feed('committees', async () => {
    const state = await repo.getSyncState('committees');
    committees.from = startDate(options.since, state.throughDate, dailStart);
    const failures = { ...state.failures };
    const listed = await client.committeeSittings(committees.from, today);
    for (const date of retryable(failures, committees.from, oldestRetry)) listed.push(...(await client.committeeSittings(date, date)));
    const byDay = groupByDay(listed, (s) => s.uri);
    committees.days = byDay.size;
    committees.failedDays = await ingestUnits('Committees', Array.from(byDay.keys()), failures, async (date) => {
      // Every sitting of the day is tried; the day is marked failed afterwards if any was.
      const errors: string[] = [];
      for (const sitting of byDay.get(date) ?? []) {
        try {
          if (!sitting.xmlUri) throw new Error('listed, but no transcript published yet');
          const roll = parseRollCall(await client.transcript(sitting.xmlUri));
          const byName = resolveRollCallNames(roll.unlinkedNames, roster);
          const present = Array.from(new Set([...roll.codes, ...byName.codes]));
          await repo.replaceCommitteeSitting(sitting, present, byName.unresolvedTds, tdIds);
          committees.sittings++;
          if (byName.unresolvedTds > 0) committees.unresolvedSittings++;
        } catch (error) {
          errors.push(`${sitting.committeeName}: ${message(error)}`);
        }
      }
      if (errors.length) throw new Error(errors.join('; '));
    }, log);
    await repo.setSyncState(
      'committees',
      resumePoint(options.since, state.throughDate, dailStart, today),
      `${committees.sittings} sittings ${committees.from}..${today}${committees.failedDays.length ? `, ${committees.failedDays.length} days failed` : ''}`,
      failures,
    );
    log(`Committees: ${committees.sittings} sittings on ${byDay.size} days, ${committees.unresolvedSittings} with a roll-call name not matched.`);
  });

  // 5. Bills: the whole term is a page or two, so it is refreshed in full every run.
  const bills: SyncSummary['bills'] = { ingested: 0 };
  await feed('bills', async () => {
    const parsed = (await client.bills(dailStart)).map(parseBill).filter((b): b is ParsedBill => b !== null);
    await repo.replaceBills(parsed, tdIds);
    await repo.setSyncState('bills', today, `${parsed.length} bills since ${dailStart}`);
    bills.ingested = parsed.length;
    log(`Bills: ${parsed.length}.`);
  });

  // 5b. The interests register and allowance payments, from the Oireachtas's PDFs.
  const disclosureContext = {
    roster: roster.map((m) => ({ memberCode: m.memberCode, fullName: m.fullName, constituency: m.constituency })),
    tdIds,
    dailStart,
    source: options.disclosures,
    log,
  };
  let interests: DisclosureResult = { files: 0, rows: 0, unmatched: [] };
  let allowances: DisclosureResult = { files: 0, rows: 0, unmatched: [] };
  await feed('interests', async () => {
    interests = await syncInterests(disclosureContext);
    if (interests.unmatched.length) log(`Interests: no current TD for ${interests.unmatched.join('; ')}.`);
  });
  await feed('allowances', async () => {
    allowances = await syncAllowances(disclosureContext);
    if (allowances.unmatched.length) log(`Allowances: no current TD for ${allowances.unmatched.join('; ')}.`);
  });

  // 6. Questions, counted per month. A failed month keeps its previous counts and is
  //    retried on every run with no cap: until it succeeds the totals below are frozen,
  //    so giving up on it would freeze them for good.
  const questions: SyncSummary['questions'] = { from: '', to: today, months: 0, failedMonths: [], questions: 0, totalsComplete: false };
  // Set inside the feed closure; the casts stop TS narrowing them to their initial values.
  let questionsThrough = null as string | null;
  let questionFailures = {} as Record<string, number>;
  await feed('questions', async () => {
    const state = await repo.getSyncState('questions');
    questionsThrough = state.throughDate;
    questionFailures = { ...state.failures };
    questions.from = startDate(options.since, state.throughDate, dailStart);
    const window = monthsBetween(questions.from, today);
    // Month keys are first-of-month, so the oldest is the Dáil's first MONTH: comparing with
    // dailStart itself ("2024-11-29") would never retry a failed November 2024.
    const months = [...window, ...retryable(questionFailures, window[0], `${dailStart.slice(0, 7)}-01`)];
    questions.months = months.length;
    questions.failedMonths = await ingestUnits('Questions', months, questionFailures, async (month) => {
      const from = month < dailStart ? dailStart : month;
      const end = monthEnd(month);
      const raws = await client.questions(from, end > today ? today : end);
      await repo.replaceQuestionMonths([month], countQuestions(raws), tdIds);
      questions.questions += raws.length;
    }, log);
    const through = resumePoint(options.since, state.throughDate, dailStart, today);
    await repo.setSyncState(
      'questions',
      through,
      `${questions.questions} questions in ${months.length} months${questions.failedMonths.length ? `, ${questions.failedMonths.length} failed` : ''}`,
      questionFailures,
    );
    questionsThrough = through ?? state.throughDate;
    log(`Questions: ${questions.questions} in ${months.length} months.`);
  });

  // 7. Link and count. Other writers (the scoring cron) touch the same rows, so the
  //    set-based steps retry on a deadlock instead of failing the whole run.
  await withDeadlockRetry(() => repo.relinkTds());
  const windows = new Map(roster.map((m) => [m.memberCode, { memberSince: m.memberSince, isPresiding: m.isPresiding }]));
  // The counts and each TD's expectations (questions_expected, attendance_benchmark) are
  // written in one transaction.
  const statsRows = await withDeadlockRetry(() => repo.recomputeStats(windows, { start: dailStart, today }));
  await withDeadlockRetry(() => repo.recomputeCommitteeStats());
  const stats = new Map((await repo.allStats()).map((s) => [s.tdId, s]));
  const expectedQuestions = new Map(
    roster.map((m) => {
      const tdId = tdIds.get(m.memberCode);
      return [m.memberCode, (tdId === undefined ? undefined : stats.get(tdId))?.questionsExpected ?? null] as const;
    }),
  );

  // 8. Scoring inputs. Question totals come from the counts above, but only when every
  //    month since the Dáil's first day is stored: a feed that has never resumed from the
  //    start (a fresh `--since` run leaves no resume point) or still has a failed month
  //    would undercount. Otherwise the last written totals are kept.
  questions.totalsComplete =
    !failedFeeds.includes('questions') &&
    questionsThrough !== null &&
    Object.keys(questionFailures).length === 0 &&
    (await repo.hasQuestionCounts());
  const totals = questions.totalsComplete ? await repo.questionTotals(dailStart) : null;
  const stored = totals ? null : await repo.storedQuestionCounts();
  if (!totals) log('Questions: not every month is stored, so question totals keep their last values.');
  const written = await withDeadlockRetry(() =>
    scoring.updateParliamentaryActivity(
      roster.map((m) => {
        const tdId = tdIds.get(m.memberCode);
        const s = tdId === undefined ? undefined : stats.get(tdId);
        // A TD not expected to ask questions (a minister, the chair) is not scored on them:
        // NULL, never 0. The profile still shows what they asked, from question_counts.
        const expected = expectedQuestions.get(m.memberCode) ?? null;
        const q = expected === null ? null : totals ? (totals.get(m.memberCode) ?? { oral: 0, written: 0 }) : stored?.get(m.memberCode);
        return {
          memberCode: m.memberCode,
          questionsOral: q?.oral ?? null,
          questionsWritten: q?.written ?? null,
          attendancePct: s ? attendancePct(s.votesCast, s.divisionsEligible, s.isPresiding) : null,
          committeeAttendancePct:
            s && s.committeeSittingsEligible !== null && s.committeeSittingsAttended !== null
              ? committeeAttendancePct(s.committeeSittingsAttended, s.committeeSittingsEligible)
              : null,
        };
      }),
    ),
  );
  await withDeadlockRetry(() => recalculateAll());

  return {
    roster: { members: roster.length, ...rosterResult, committeeMemberships },
    divisions,
    debates,
    committees,
    bills,
    questions,
    interests,
    allowances,
    failedFeeds,
    statsRows,
    scoringRowsWritten: written,
  };
}

/**
 * Dáil divisions as fixed-option TD stances (docs/plans/quiz-improvements/01c).
 *
 *   classifyDivisions     model calls → division_readings. Call 1 says what a Tá vote supported,
 *                         with a quote checked against the proposal; call 2 picks the option of
 *                         an existing daily-vote question it states, or none; call 3 (only after a
 *                         match) lists what that option says that the vote does not, and any such
 *                         claim refuses the match. Never touches td_stances or evidence.
 *   syncDivisionStances   readings × roll call → td_stances rows (quote kind 'division'), then
 *                         the whole `stance` evidence set rebuilt from td_stances, then every TD
 *                         and party profile. No model calls.
 *   runDivisionStances    the nightly run: at most NIGHTLY_LIMIT model calls, then the sync. The
 *                         scheduler calls it only when DIVISION_STANCES=on.
 *   runDivisionAudit      the matches against the lobbies' party baselines. Writes nothing.
 *
 * Every model call goes through a `DivisionCompletion`, so tests never reach a model.
 */
import { createHash } from 'node:crypto';
import { emptyIdeologyVector, IDEOLOGY_DIMENSIONS, type IdeologyDimension, type IdeologyVector } from '@shared/ideology';
import { AUDIT_UNSCORED_DIMENSIONS, DIVISION_READING_STATUSES, type DivisionKind, type DivisionReadingStatus, type DivisionRejectReason } from '@shared/divisionMeaning';
import type { DivisionReadingRow, NewDivisionReading } from '@shared/schema/stances';
import { recomputeTdsAndParties, replaceStanceEvidence } from '../ideology';
import { partyBaseline } from '../ideology/partyBaselines';
import { oireachtasVoteUrl, repository as parliament, type DivisionContext, type DivisionRef, type DivisionVoteRecord } from '../parliament';
import { callChatCompletion, isLLMConfigured } from '../services/aiService';
import { candidateQuestions, questionsWithPositions, type QuestionPositions } from '../voting';
import { divisionStanceRows } from './discipline';
import {
  FIT_SYSTEM_PROMPT,
  MATCH_PROMPT_VERSION,
  MATCH_SYSTEM_PROMPT,
  MEANING_PROMPT_VERSION,
  MEANING_SYSTEM_PROMPT,
  divisionUserPrompt,
  fitUserPrompt,
  matchUserPrompt,
  parseFit,
  parseMatch,
  parseMeaning,
  proposalBlocks,
} from './divisionPrompt';
import { verifyMatch, verifyMeaning } from './divisionVerify';
import { stanceEvidenceRows } from './evidence';
import { QUOTE_MIN_WORDS } from './extract';
import * as repo from './repository';

/** The model asked for; a configured provider (DeepSeek) replaces it, so the answer's own model is stored. */
const DIVISION_MODEL = 'gpt-4o-mini';
/** Model calls per nightly run. */
export const NIGHTLY_LIMIT = 20;
/** A failed reading is retried until this many calls in a row have failed. */
export const MAX_ATTEMPTS = 3;
/** A division with no debate record waits this long for one, then is read on what exists. */
export const NO_CONTEXT_DAYS = 14;
/** A daily-vote question is a candidate when it is dated within this many days of the vote. */
export const MATCH_WINDOW_DAYS = 60;
export const MAX_CANDIDATES = 12;
/** A no-match is checked again at most this often, and only when its candidates changed. */
export const MATCH_RECHECK_DAYS = 7;

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// The model call
// ---------------------------------------------------------------------------

export interface DivisionAnswer {
  content: string | null;
  /** The model that answered. */
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/** One model call. Throws on failure, which records the reading as `failed`. */
export type DivisionCompletion = (system: string, user: string) => Promise<DivisionAnswer>;

export const divisionCompletion: DivisionCompletion = async (system, user) => {
  const response = await callChatCompletion(
    {
      model: DIVISION_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    { timeoutMs: 60_000, retries: 1, operation: 'division-stances' },
  );
  return {
    content: response.choices[0]?.message.content ?? null,
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
  };
};

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

/** What a reading was made from. A corrected record changes it, and `--reclassify` re-reads it. */
export function divisionInputHash(d: DivisionRef): string {
  const input = [d.subject, d.debateTitle, d.debateSectionId, d.sectionPosition, d.taCount, d.nilCount, d.staonCount];
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16);
}

const NO_READING = {
  rejectReason: null,
  divisionKind: null,
  taMeans: null,
  quoteBlock: null,
  quote: null,
  policyDomain: null,
  secondDomain: null,
  meaningConfidence: null,
  meaningPromptVersion: null,
  ...noMatch(),
  model: null,
  promptTokens: null,
  completionTokens: null,
} satisfies Partial<NewDivisionReading>;

function noMatch() {
  return { matchConfidence: null, candidateIds: null, questionId: null, taOptionKey: null, nilOptionKey: null, matchReason: null, matchPromptVersion: null, matchCheckedAt: null };
}

/** The meaning fields of a row whose meaning was verified (call 1 passed every check). */
type Meaning = Pick<
  NewDivisionReading,
  'divisionKind' | 'taMeans' | 'quoteBlock' | 'quote' | 'policyDomain' | 'secondDomain' | 'meaningConfidence' | 'meaningPromptVersion'
>;
const meaningOf = (row: DivisionReadingRow): Meaning => ({
  divisionKind: row.divisionKind,
  taMeans: row.taMeans,
  quoteBlock: row.quoteBlock,
  quote: row.quote,
  policyDomain: row.policyDomain,
  secondDomain: row.secondDomain,
  meaningConfidence: row.meaningConfidence,
  meaningPromptVersion: row.meaningPromptVersion,
});
/** A verified quote is stored only when call 1 passed every check. */
const hasMeaning = (row: DivisionReadingRow) => row.quote !== null;
const domainsOf = (m: Meaning) => [m.policyDomain, m.secondDomain].filter((d): d is string => Boolean(d));

const isStale = (ref: DivisionRef, row: DivisionReadingRow) =>
  row.inputHash !== divisionInputHash(ref) || (row.meaningPromptVersion !== null && row.meaningPromptVersion !== MEANING_PROMPT_VERSION);
const matchIsStale = (row: DivisionReadingRow) => row.matchPromptVersion !== null && row.matchPromptVersion !== MATCH_PROMPT_VERSION;

/** meaning: call 1 (and 2); match: call 2 only; recheck: look for new candidates first, no call unless they changed. */
type Stage = 'meaning' | 'match' | 'recheck';

function stageFor(ref: DivisionRef, row: DivisionReadingRow | undefined, o: { reclassify: boolean; now: Date; windowDays: number }): Stage | null {
  if (!row) return 'meaning';
  if (o.reclassify && isStale(ref, row)) return 'meaning';
  if (o.reclassify && hasMeaning(row) && (row.status === 'matched' || matchIsStale(row))) return 'match';
  const windowOpen = o.now.getTime() <= Date.parse(`${ref.date}T00:00:00Z`) + o.windowDays * DAY_MS;
  switch (row.status) {
    case 'no_context':
      return 'meaning';
    case 'failed':
      return row.attempts < MAX_ATTEMPTS ? (hasMeaning(row) ? 'match' : 'meaning') : null;
    case 'no_candidates':
      return windowOpen ? 'recheck' : null;
    case 'no_match':
      return windowOpen && (!row.matchCheckedAt || o.now.getTime() - row.matchCheckedAt.getTime() >= MATCH_RECHECK_DAYS * DAY_MS) ? 'recheck' : null;
    default:
      return null; // matched, procedural, rejected: only --reclassify reads them again
  }
}

/** One division as the dry run and the audit print it. */
export interface DivisionReading {
  divisionId: string;
  date: string;
  subject: string | null;
  status: DivisionReadingStatus;
  rejectReason: DivisionRejectReason | null;
  divisionKind: DivisionKind | null;
  taMeans: string | null;
  /** The PROPOSAL labels that were sent. */
  blocks: string[];
  quoteBlock: string | null;
  quote: string | null;
  candidates: number;
  match: { questionId: number; question: string; ta: string; nil: string | null; confidence: number } | null;
  model: string | null;
  error: string | null;
}

interface ReadDeps {
  complete: DivisionCompletion;
  now: Date;
  windowDays: number;
  /** Model calls this division may still make. */
  callsLeft: number;
}

interface ReadResult {
  /** null = nothing to write (a re-check that found nothing new). */
  row: NewDivisionReading | null;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  reading: DivisionReading;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

async function readDivision(ref: DivisionRef, previous: DivisionReadingRow | undefined, stage: Stage, deps: ReadDeps): Promise<ReadResult | null> {
  const context = await parliament.divisionContext(ref.id);
  if (!context) return null;
  const d = context.division;
  const at = Date.parse(`${d.date}T00:00:00Z`);
  const from = new Date(at - deps.windowDays * DAY_MS);
  const to = new Date(at + deps.windowDays * DAY_MS);
  const fresh = !previous || stage === 'meaning';
  const base: NewDivisionReading = {
    divisionId: ref.id,
    status: 'failed',
    ...NO_READING,
    ...(previous && !fresh ? meaningOf(previous) : {}),
    inputHash: divisionInputHash(d),
    attempts: previous && !isStale(d, previous) ? previous.attempts : 0,
    readAt: deps.now,
  };
  const result: ReadResult = {
    row: null,
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    reading: {
      divisionId: ref.id,
      date: d.date,
      subject: d.subject,
      status: 'failed',
      rejectReason: null,
      divisionKind: (base.divisionKind ?? null) as DivisionKind | null,
      taMeans: base.taMeans ?? null,
      blocks: [],
      quoteBlock: base.quoteBlock ?? null,
      quote: base.quote ?? null,
      candidates: 0,
      match: null,
      model: null,
      error: null,
    },
  };
  const done = (row: NewDivisionReading) => {
    result.row = row;
    Object.assign(result.reading, {
      status: row.status,
      rejectReason: row.rejectReason ?? null,
      divisionKind: row.divisionKind ?? null,
      taMeans: row.taMeans ?? null,
      quoteBlock: row.quoteBlock ?? null,
      quote: row.quote ?? null,
      model: row.model ?? null,
    });
    return result;
  };
  const call = async (system: string, user: string): Promise<DivisionAnswer | Error> => {
    result.calls++;
    try {
      const answer = await deps.complete(system, user);
      result.promptTokens += answer.promptTokens ?? 0;
      result.completionTokens += answer.completionTokens ?? 0;
      return answer;
    } catch (error) {
      return error instanceof Error ? error : new Error(message(error));
    }
  };
  const usage = (answer: DivisionAnswer) => ({ model: answer.model.slice(0, 60), promptTokens: result.promptTokens, completionTokens: result.completionTokens });
  const failed = (row: NewDivisionReading, error: string) => {
    result.reading.error = error;
    return done({ ...row, status: 'failed', attempts: (row.attempts ?? 0) + 1 });
  };

  let meaning: Meaning;
  if (stage !== 'meaning' && previous && hasMeaning(previous)) {
    meaning = meaningOf(previous);
  } else {
    // ---- before any call: is there anything to match it to, and anything to read? ----
    if ((await candidateQuestions({ from, to, limit: 1 })).length === 0) {
      return stage === 'recheck' ? null : done({ ...base, status: 'no_candidates' });
    }
    const young = (deps.now.getTime() - at) / DAY_MS < NO_CONTEXT_DAYS;
    if (context.speeches.length === 0 && young) return done({ ...base, status: 'no_context' });
    const blocks = proposalBlocks(context);
    result.reading.blocks = blocks.map((b) => b.label);
    if (wordCount(blocks.map((b) => b.text).join(' ')) < QUOTE_MIN_WORDS) {
      return done(young ? { ...base, status: 'no_context' } : { ...base, status: 'rejected', rejectReason: 'quote_not_found' });
    }
    // Call 1 may lead to calls 2 and 3: start only with room for all three.
    if (deps.callsLeft < 3) return null;

    // ---- call 1: the meaning ----
    const answer = await call(MEANING_SYSTEM_PROMPT, divisionUserPrompt(context, blocks));
    if (answer instanceof Error) return failed(base, answer.message);
    const reply = parseMeaning(answer.content);
    if (!reply) return failed({ ...base, ...usage(answer) }, 'unusable model output');
    const check = verifyMeaning(reply, blocks);
    const read = {
      ...base,
      ...usage(answer),
      attempts: 0,
      divisionKind: reply.divisionKind,
      taMeans: reply.taMeans || null,
      meaningConfidence: reply.confidence,
      meaningPromptVersion: MEANING_PROMPT_VERSION,
    };
    if (check.status === 'procedural') return done({ ...read, status: 'procedural' });
    if (check.status === 'rejected') {
      result.reading.quoteBlock = reply.quoteBlock || null;
      result.reading.quote = reply.quote || null;
      return done({ ...read, status: 'rejected', rejectReason: check.reason });
    }
    meaning = { ...read, quoteBlock: check.block, quote: check.quote, policyDomain: check.domains[0]!, secondDomain: check.domains[1] ?? null };
    Object.assign(base, read, meaning);
  }

  // ---- call 2: the match ----
  const candidates = await candidateQuestions({ domains: domainsOf(meaning), from, to, limit: MAX_CANDIDATES });
  result.reading.candidates = candidates.length;
  const ids = candidates.map((c) => c.id).sort((a, b) => a - b);
  const known = previous?.candidateIds ? [...previous.candidateIds].sort((a, b) => a - b) : null;
  if (stage === 'recheck') {
    const same = known !== null && known.length === ids.length && known.every((id, i) => id === ids[i]);
    if (candidates.length === 0 || (previous?.status === 'no_match' && same)) return null;
  }
  if (candidates.length === 0) return done({ ...base, ...meaning, status: 'no_candidates', candidateIds: [] });
  if (result.calls === 0 && deps.callsLeft < 2) return null; // the match, and the claims check if it matches
  const answer = await call(
    MATCH_SYSTEM_PROMPT,
    matchUserPrompt({ taMeans: meaning.taMeans ?? '', quote: meaning.quote ?? '', divisionKind: meaning.divisionKind as DivisionKind }, candidates),
  );
  const matchBase: NewDivisionReading = { ...base, ...meaning, ...noMatch(), candidateIds: ids, matchCheckedAt: deps.now };
  if (answer instanceof Error) return failed(matchBase, answer.message);
  const reply = parseMatch(answer.content);
  if (!reply) return failed({ ...matchBase, ...usage(answer) }, 'unusable model output');
  const check = verifyMatch(reply, candidates, `${meaning.quote ?? ''} ${meaning.taMeans ?? ''}`);
  const checked = { ...matchBase, ...usage(answer), attempts: 0, matchConfidence: reply.confidence, matchReason: reply.reason || null, matchPromptVersion: MATCH_PROMPT_VERSION };
  if (check.status === 'no_match') {
    // Keep why: a match the model made but the figures check refused is worth a person's eye.
    const refused = check.overstated ? { matchReason: `Refused: the answer names ${check.overstated.join(', ')}, which the proposal does not. Model said: ${reply.reason}`.slice(0, 500) } : {};
    return done({ ...checked, ...refused, status: 'no_match' });
  }
  if (check.status === 'rejected') return done({ ...checked, status: 'rejected', rejectReason: check.reason });
  const question = candidates.find((c) => c.id === check.questionId)!;
  const label = (key: string | null) => question.options.find((o) => o.key === key)?.label ?? null;

  // ---- call 3: does the vote state everything the matched answer says? ----
  const fitAnswer = await call(FIT_SYSTEM_PROMPT, fitUserPrompt({ taMeans: meaning.taMeans ?? '', quote: meaning.quote ?? '', answer: label(check.taOption)! }));
  if (fitAnswer instanceof Error) return failed({ ...matchBase, ...usage(answer) }, fitAnswer.message);
  const unstated = parseFit(fitAnswer.content);
  if (!unstated) return failed({ ...matchBase, ...usage(fitAnswer) }, 'unusable model output');
  if (unstated.length > 0) {
    return done({
      ...checked,
      ...usage(fitAnswer),
      matchReason: `Refused: the proposal does not state: ${unstated.join('; ')}. Model said: ${reply.reason}`.slice(0, 500),
      status: 'no_match',
    });
  }
  result.reading.match = { questionId: question.id, question: question.question, ta: label(check.taOption)!, nil: label(check.nilOption), confidence: check.confidence };
  return done({ ...checked, ...usage(fitAnswer), status: 'matched', questionId: check.questionId, taOptionKey: check.taOption, nilOptionKey: check.nilOption });
}

export interface ClassifyOptions {
  /** Read at most this many divisions that need a model call (newest first). */
  limit?: number | null;
  /** At most this many model calls in all (the nightly run). */
  maxCalls?: number | null;
  /** Make the calls, write nothing. */
  dryRun?: boolean;
  /** Also re-read readings with an old prompt version or a changed record, and re-match matched ones. */
  reclassify?: boolean;
  /** Days either side of the vote a question may be dated (the dry run may widen it). */
  windowDays?: number;
  complete?: DivisionCompletion;
  now?: Date;
}

export interface ClassifySummary {
  /** Divisions with work to do (some need no call). */
  pending: number;
  /** Divisions on which a model call was made. */
  read: number;
  calls: number;
  statuses: Record<DivisionReadingStatus, number>;
  promptTokens: number;
  completionTokens: number;
  /** Divisions read with a model call, in the order read. */
  readings: DivisionReading[];
}

/**
 * Read the divisions that need it: first those with no usable meaning (newest first), then the
 * re-checks of no-match and no-candidate readings (oldest check first). Writes
 * `division_readings` only, and nothing with `dryRun`.
 */
export async function classifyDivisions(options: ClassifyOptions = {}): Promise<ClassifySummary> {
  const { limit = null, maxCalls = null, dryRun = false, reclassify = false, windowDays = MATCH_WINDOW_DAYS, complete = divisionCompletion, now = new Date() } = options;
  const [refs, rows] = await Promise.all([parliament.listDivisionRefs(), repo.listDivisionReadings()]);
  const byId = new Map(rows.map((r) => [r.divisionId, r]));
  const work = refs
    .map((ref) => ({ ref, row: byId.get(ref.id), stage: stageFor(ref, byId.get(ref.id), { reclassify, now, windowDays }) }))
    .filter((w): w is { ref: DivisionRef; row: DivisionReadingRow | undefined; stage: Stage } => w.stage !== null);
  const checkedAt = (w: (typeof work)[number]) => w.row?.matchCheckedAt?.getTime() ?? 0;
  // refs are newest first; meanings keep that order, re-checks go oldest check first.
  work.sort((a, b) => Number(a.stage !== 'meaning') - Number(b.stage !== 'meaning') || (a.stage === 'meaning' ? 0 : checkedAt(a) - checkedAt(b)));

  const summary: ClassifySummary = {
    pending: work.length,
    read: 0,
    calls: 0,
    statuses: Object.fromEntries(DIVISION_READING_STATUSES.map((s) => [s, 0])) as Record<DivisionReadingStatus, number>,
    promptTokens: 0,
    completionTokens: 0,
    readings: [],
  };
  for (const w of work) {
    if (limit !== null && summary.read >= limit) break;
    const callsLeft = maxCalls === null ? Number.POSITIVE_INFINITY : maxCalls - summary.calls;
    if (callsLeft <= 0) break;
    const result = await readDivision(w.ref, w.row, w.stage, { complete, now, windowDays, callsLeft });
    if (!result || !result.row) continue;
    summary.statuses[result.row.status as DivisionReadingStatus]++;
    if (result.calls > 0) {
      summary.read++;
      summary.calls += result.calls;
      summary.promptTokens += result.promptTokens;
      summary.completionTokens += result.completionTokens;
      summary.readings.push(result.reading);
    }
    if (!dryRun) await repo.upsertDivisionReading(result.row);
  }
  return summary;
}

// ---------------------------------------------------------------------------
// The sync: readings × roll call → td_stances → evidence → profiles
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) out.set(key(item), [...(out.get(key(item)) ?? []), item]);
  return out;
}

const unique = (ids: Array<number | null>) => Array.from(new Set(ids.filter((id): id is number => id !== null)));

export interface StanceSyncSummary {
  /** Matched divisions that gave at least one td_stances row. */
  divisions: number;
  /** td_stances rows for Dáil votes. */
  rows: number;
  /** Matched divisions with no oireachtas.ie link, so no rows. */
  skipped: number;
  /** `stance` evidence rows, news and votes. */
  evidence: number;
  tds: number;
  parties: number;
}

/**
 * Every matched reading and the roll call → the whole set of Dáil-vote td_stances rows (one
 * transaction); then the whole `stance` evidence set rebuilt from td_stances, news included (one
 * transaction); then every TD and party recomputed from the committed rows. No model calls.
 */
export async function syncDivisionStances(now = new Date()): Promise<StanceSyncSummary> {
  const [readings, records, refs] = await Promise.all([repo.listDivisionReadings(), parliament.divisionVoteRecords(), parliament.listDivisionRefs()]);
  const matched = readings.filter((r) => r.status === 'matched' && r.questionId !== null && r.taOptionKey !== null && r.quote !== null);
  const questions = new Map((await questionsWithPositions(unique(matched.map((r) => r.questionId)))).map((q) => [q.id, q]));
  const refOf = new Map(refs.map((d) => [d.id, d]));
  const votesOf = groupBy(records, (r) => r.divisionId);

  const rows: ReturnType<typeof divisionStanceRows> = [];
  let divisions = 0;
  let skipped = 0;
  for (const r of matched) {
    const ref = refOf.get(r.divisionId);
    const question = questions.get(r.questionId!);
    if (!ref || !question) continue;
    const url = oireachtasVoteUrl(r.divisionId);
    if (url === null) {
      skipped++;
      continue;
    }
    const out = divisionStanceRows(
      { divisionId: r.divisionId, questionId: r.questionId!, taOptionKey: r.taOptionKey!, nilOptionKey: r.nilOptionKey, quote: r.quote! },
      ref,
      question,
      votesOf.get(r.divisionId) ?? [],
      url,
    );
    if (out.length > 0) divisions++;
    rows.push(...out);
  }
  await repo.replaceDivisionStances(rows);

  const stances = await repo.stanceRowsForEvidence();
  const evidence = stanceEvidenceRows(stances, await questionsWithPositions(unique(stances.map((s) => s.questionId))));
  await replaceStanceEvidence(evidence);
  const recomputed = await recomputeTdsAndParties(now);
  return { divisions, rows: rows.length, skipped, evidence: evidence.length, ...recomputed };
}

// ---------------------------------------------------------------------------
// The nightly run
// ---------------------------------------------------------------------------

/** Thrown when a run is already in flight in this process. */
export class DivisionStancesAlreadyRunning extends Error {}
let inFlight = false;

export interface DivisionStancesRun {
  /** null when no LLM is configured: nothing was read. */
  classify: ClassifySummary | null;
  sync: StanceSyncSummary;
}

/** The nightly run: at most NIGHTLY_LIMIT model calls (never a re-match of a matched division), then the sync. */
export async function runDivisionStances(options: {
  mode: 'nightly';
  complete?: DivisionCompletion;
  llmConfigured?: boolean;
  now?: Date;
  log?: (line: string) => void;
}): Promise<DivisionStancesRun> {
  if (inFlight) throw new DivisionStancesAlreadyRunning('A division stances run is already in flight');
  inFlight = true;
  try {
    const now = options.now ?? new Date();
    const log = options.log ?? ((line: string) => console.log(line));
    const classify = (options.llmConfigured ?? isLLMConfigured()) ? await classifyDivisions({ maxCalls: NIGHTLY_LIMIT, complete: options.complete, now }) : null;
    const sync = await syncDivisionStances(now);
    const read = classify
      ? `read ${classify.read} of ${classify.pending} division(s) needing work (${DIVISION_READING_STATUSES.map((s) => `${s} ${classify.statuses[s]}`).join(', ')}), ` +
        `${classify.calls} model call(s), ${classify.promptTokens} prompt + ${classify.completionTokens} completion tokens`
      : 'no LLM configured, nothing read';
    log(
      `[division-stances] ${read}; ${sync.rows} vote stance(s) from ${sync.divisions} matched division(s)${sync.skipped ? `, ${sync.skipped} skipped (no link)` : ''}; ` +
        `${sync.evidence} stance evidence row(s); recomputed ${sync.tds} TDs and ${sync.parties} parties.`,
    );
    return { classify, sync };
  } finally {
    inFlight = false;
  }
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

/** A dimension is checked only where the Tá and Níl options differ at least this much (−2..+2)… */
export const AUDIT_MIN_LEAN = 0.5;
/** …and the lobbies' mean party baselines are at least this far apart (−10..+10). */
export const AUDIT_MIN_GAP = 2;

export interface AuditCount {
  agree: number;
  total: number;
}

export interface AuditReading {
  divisionId: string;
  taMeans: string | null;
  /** The Tá option's vector; the Níl option's, or none. */
  taVector: IdeologyVector;
  nilVector: IdeologyVector | null;
}

export interface DivisionAudit {
  /** Matched divisions with at least one dimension checked. */
  divisions: number;
  agree: number;
  total: number;
  byDimension: Record<IdeologyDimension, AuditCount>;
  /** Every matched division with a disagreement, most first. */
  worst: Array<{
    divisionId: string;
    taMeans: string | null;
    disagreements: Array<{ dimension: IdeologyDimension; direction: number; gap: number }>;
  }>;
}

type AuditVote = Pick<DivisionVoteRecord, 'divisionId' | 'party' | 'vote'>;

/** Mean party baseline of one lobby on each dimension; null when no voter in it has a baseline. */
function lobbyMean(votes: AuditVote[]): Record<IdeologyDimension, number> | null {
  const baselines = votes.map((v) => partyBaseline(v.party)).filter((b) => b !== null);
  if (baselines.length === 0) return null;
  return Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, baselines.reduce((s, b) => s + b[d], 0) / baselines.length])) as Record<IdeologyDimension, number>;
}

/**
 * How often a match points the same way as the vote. On each dimension where the Tá option and
 * the Níl option (none = 0) differ by at least AUDIT_MIN_LEAN and the Tá and Níl lobbies' mean
 * party baselines differ by at least AUDIT_MIN_GAP, sign(Tá − Níl) should match sign(Tá lobby −
 * Níl lobby). The prompts name no party, sponsor or bill source, so this is an independent check.
 * AUDIT_UNSCORED_DIMENSIONS are tallied in `byDimension` but left out of `agree`, `total` and
 * `worst`. Pure.
 */
export function auditDivisions(readings: AuditReading[], votes: AuditVote[]): DivisionAudit {
  const votesOf = groupBy(votes, (v) => v.divisionId);
  const byDimension = Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, { agree: 0, total: 0 }])) as Record<IdeologyDimension, AuditCount>;
  const worst: DivisionAudit['worst'] = [];
  let divisions = 0;
  for (const r of readings) {
    const lobby = votesOf.get(r.divisionId) ?? [];
    const ta = lobbyMean(lobby.filter((v) => v.vote === 'ta'));
    const nil = lobbyMean(lobby.filter((v) => v.vote === 'nil'));
    if (!ta || !nil) continue;
    const nilVector = r.nilVector ?? emptyIdeologyVector();
    const disagreements: DivisionAudit['worst'][number]['disagreements'] = [];
    let checked = 0;
    for (const d of IDEOLOGY_DIMENSIONS) {
      const direction = r.taVector[d] - nilVector[d];
      const gap = ta[d] - nil[d];
      if (Math.abs(direction) < AUDIT_MIN_LEAN || Math.abs(gap) < AUDIT_MIN_GAP) continue;
      const agrees = Math.sign(direction) === Math.sign(gap);
      byDimension[d].total++;
      if (agrees) byDimension[d].agree++;
      if (AUDIT_UNSCORED_DIMENSIONS.includes(d)) continue; // counted above, never in the score or the disagreements
      checked++;
      if (!agrees) disagreements.push({ dimension: d, direction, gap: Math.round(gap * 100) / 100 });
    }
    if (checked > 0) divisions++;
    if (disagreements.length > 0) worst.push({ divisionId: r.divisionId, taMeans: r.taMeans, disagreements });
  }
  const gapOf = (w: DivisionAudit['worst'][number]) => w.disagreements.reduce((s, d) => s + Math.abs(d.gap), 0);
  worst.sort((a, b) => b.disagreements.length - a.disagreements.length || gapOf(b) - gapOf(a));
  const scored = IDEOLOGY_DIMENSIONS.filter((d) => !AUDIT_UNSCORED_DIMENSIONS.includes(d));
  const agree = scored.reduce((s, d) => s + byDimension[d].agree, 0);
  const total = scored.reduce((s, d) => s + byDimension[d].total, 0);
  return { divisions, agree, total, byDimension, worst };
}

/** One matched division, as the audit prints it for a person to read. */
export interface MatchedForReview {
  divisionId: string;
  date: string;
  subject: string | null;
  divisionKind: string | null;
  taMeans: string | null;
  quoteBlock: string | null;
  quote: string | null;
  question: string;
  ta: string | null;
  nil: string | null;
  meaningConfidence: number | null;
  matchConfidence: number | null;
  url: string | null;
}

/** The audit over every matched reading, and every matched division for review. No model calls, writes nothing. */
export async function runDivisionAudit(): Promise<{ audit: DivisionAudit; matched: MatchedForReview[] }> {
  const [readings, votes, refs] = await Promise.all([repo.listDivisionReadings(), parliament.divisionVoteRecords(), parliament.listDivisionRefs()]);
  const matched = readings.filter((r) => r.status === 'matched' && r.questionId !== null);
  const questions = new Map<number, QuestionPositions>((await questionsWithPositions(unique(matched.map((r) => r.questionId)))).map((q) => [q.id, q]));
  const refOf = new Map(refs.map((d) => [d.id, d]));
  const option = (r: DivisionReadingRow, key: string | null) => questions.get(r.questionId!)?.options.find((o) => o.key === key) ?? null;
  const auditable: AuditReading[] = matched.flatMap((r) => {
    const ta = option(r, r.taOptionKey);
    return ta ? [{ divisionId: r.divisionId, taMeans: r.taMeans, taVector: ta.vector, nilVector: option(r, r.nilOptionKey)?.vector ?? null }] : [];
  });
  return {
    audit: auditDivisions(auditable, votes),
    matched: matched.map((r) => ({
      divisionId: r.divisionId,
      date: refOf.get(r.divisionId)?.date ?? '',
      subject: refOf.get(r.divisionId)?.subject ?? null,
      divisionKind: r.divisionKind,
      taMeans: r.taMeans,
      quoteBlock: r.quoteBlock,
      quote: r.quote,
      question: questions.get(r.questionId!)?.question ?? `question ${r.questionId}`,
      ta: option(r, r.taOptionKey)?.label ?? null,
      nil: option(r, r.nilOptionKey)?.label ?? null,
      meaningConfidence: r.meaningConfidence,
      matchConfidence: r.matchConfidence,
      url: oireachtasVoteUrl(r.divisionId),
    })),
  };
}

export type { DivisionContext };

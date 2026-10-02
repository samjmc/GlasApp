/**
 * Dáil divisions as TD evidence. A model reads what each division meant, once (cached in
 * `division_ideology`); the votes that were each TD's own then become evidence rows, derived
 * as a set and replaced whole.
 *
 *   classifyDivisions     readings → division_ideology. Model calls. Never touches evidence.
 *   syncDivisionEvidence  readings + votes → td_ideology_evidence (source 'division'), then
 *                         every TD and party profile. No model calls.
 *   runDivisionIdeology   the nightly run: at most NIGHTLY_LIMIT readings, then the sync.
 *                         The scheduler calls it only when DIVISION_IDEOLOGY=on.
 *   runDivisionAudit      readings against the lobbies' party baselines. Writes nothing.
 *
 * Every model call goes through a `DivisionCompletion`, so tests never reach a model.
 */
import { createHash } from 'node:crypto';
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '@shared/ideology';
import { DIVISION_MEANING_STATUSES, type DivisionMeaningStatus } from '@shared/divisionMeaning';
import type { DivisionIdeologyRow, DivisionLean, NewDivisionIdeology, NewTdIdeologyEvidence } from '@shared/schema/quiz';
import { repository as parliament, type DivisionContext, type DivisionVoteRecord } from '../parliament';
import { callChatCompletion, isLLMConfigured } from '../services/aiService';
import { capDivisionWeights, divisionEvidence, MIN_DIVISION_CONFIDENCE, type DivisionMeaning } from './divisionEvidence';
import {
  DIVISION_PROMPT_VERSION,
  DIVISION_SYSTEM_PROMPT,
  divisionUserPrompt,
  parseDivisionClassification,
  type DivisionClassification,
} from './divisionPrompt';
import { partyBaseline } from './partyBaselines';
import * as repo from './repository';
import { recomputeTdsAndParties } from './service';
import { hasSignal, toObservationVector } from './sources';

/** The model asked for; a configured provider (DeepSeek) replaces it, so the answer's own model is stored. */
const DIVISION_MODEL = 'gpt-4o-mini';
/** Readings per nightly run. It never re-reads: that is `--reclassify`, by hand. */
export const NIGHTLY_LIMIT = 20;
/** A failed reading is retried until it has had this many model calls. */
export const MAX_ATTEMPTS = 3;
/** A division with no debate record waits this long for one, then is read on its metadata alone. */
export const NO_CONTEXT_DAYS = 14;

type DivisionRef = DivisionContext['division'];

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
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    { timeoutMs: 60_000, retries: 1, operation: 'division-ideology' },
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
  taLean: null,
  nilLean: null,
  nilWeight: null,
  confidence: null,
  salience: null,
  divisionKind: null,
  procedural: null,
  freeVote: null,
  policyTopic: null,
  taMeans: null,
  reasoning: null,
  model: null,
  promptTokens: null,
  completionTokens: null,
} satisfies Partial<NewDivisionIdeology>;

/** Procedural, or neither lobby says anything above the noise floor. */
function statusOf(c: DivisionClassification): DivisionMeaningStatus {
  const says = (lean: DivisionLean) => hasSignal(toObservationVector('division', lean));
  return c.procedural || !(says(c.taLean) || says(c.nilLean)) ? 'no_signal' : 'classified';
}

const isStale = (ref: DivisionRef, row: DivisionIdeologyRow) =>
  row.promptVersion !== DIVISION_PROMPT_VERSION || row.inputHash !== divisionInputHash(ref);

/** No reading yet, waiting for a debate record, or failed with calls to spare; with `reclassify`, also stale. */
function needsReading(ref: DivisionRef, row: DivisionIdeologyRow | undefined, reclassify: boolean): boolean {
  if (!row || row.status === 'no_context') return true;
  if (reclassify && isStale(ref, row)) return true;
  return row.status === 'failed' && row.attempts < MAX_ATTEMPTS;
}

export interface DivisionReading {
  divisionId: string;
  date: string;
  subject: string | null;
  status: DivisionMeaningStatus;
  /** The parsed reading; null when there was no call or no usable answer. */
  classification: DivisionClassification | null;
  model: string | null;
  error: string | null;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const DAY_MS = 86_400_000;

/** Read one division. Null when it no longer exists. */
async function readDivision(ref: DivisionRef, previous: DivisionIdeologyRow | undefined, complete: DivisionCompletion, now: Date) {
  const context = await parliament.divisionContext(ref.id);
  if (!context) return null;
  const inputHash = divisionInputHash(context.division);
  // Attempts count calls for this prompt version and this input; a new one starts again.
  const attempts = previous && !isStale(context.division, previous) ? previous.attempts : 0;
  const base = { divisionId: ref.id, promptVersion: DIVISION_PROMPT_VERSION, inputHash, attempts, classifiedAt: now, ...NO_READING };
  const reading = { divisionId: ref.id, date: ref.date, subject: ref.subject, classification: null, model: null, error: null };

  const ageDays = (now.getTime() - Date.parse(`${ref.date}T00:00:00Z`)) / DAY_MS;
  if (context.speeches.length === 0 && ageDays < NO_CONTEXT_DAYS) {
    return { row: { ...base, status: 'no_context' as const }, reading: { ...reading, status: 'no_context' as const }, called: false, answer: null };
  }

  let answer: DivisionAnswer;
  try {
    answer = await complete(DIVISION_SYSTEM_PROMPT, divisionUserPrompt(context));
  } catch (error) {
    return {
      row: { ...base, status: 'failed' as const, attempts: attempts + 1 },
      reading: { ...reading, status: 'failed' as const, error: message(error) },
      called: true,
      answer: null,
    };
  }
  const usage = { model: answer.model.slice(0, 60), promptTokens: answer.promptTokens, completionTokens: answer.completionTokens, attempts: attempts + 1 };
  const parsed = parseDivisionClassification(answer.content);
  if (!parsed) {
    return {
      row: { ...base, ...usage, status: 'failed' as const },
      reading: { ...reading, status: 'failed' as const, model: usage.model, error: 'unusable model output' },
      called: true,
      answer,
    };
  }
  const status = statusOf(parsed);
  const row: NewDivisionIdeology = {
    ...base,
    ...usage,
    status,
    taLean: parsed.taLean,
    nilLean: parsed.nilLean,
    nilWeight: parsed.nilWeight,
    confidence: parsed.confidence,
    salience: parsed.salience,
    divisionKind: parsed.divisionKind,
    procedural: parsed.procedural,
    freeVote: parsed.freeVote,
    policyTopic: parsed.policyTopic,
    taMeans: parsed.taMeans,
    reasoning: parsed.reasoning,
  };
  return { row, reading: { ...reading, status, classification: parsed, model: usage.model }, called: true, answer };
}

export interface ClassifyOptions {
  /** Read at most this many (newest first). */
  limit?: number | null;
  /** Make the calls, write nothing. */
  dryRun?: boolean;
  /** Also re-read readings with an old prompt version or a changed record. */
  reclassify?: boolean;
  complete?: DivisionCompletion;
  now?: Date;
}

export interface ClassifySummary {
  /** Divisions that needed a reading. */
  pending: number;
  /** Divisions read in this run. */
  read: number;
  calls: number;
  statuses: Record<DivisionMeaningStatus, number>;
  promptTokens: number;
  completionTokens: number;
  readings: DivisionReading[];
}

/**
 * Read the divisions that need it, newest first: those with no reading, those waiting for a
 * debate record, and failed ones under MAX_ATTEMPTS. Writes `division_ideology` only.
 */
export async function classifyDivisions(options: ClassifyOptions = {}): Promise<ClassifySummary> {
  const { limit = null, dryRun = false, reclassify = false, complete = divisionCompletion, now = new Date() } = options;
  const [refs, rows] = await Promise.all([parliament.listDivisionRefs(), repo.listDivisionMeanings()]);
  const byId = new Map(rows.map((r) => [r.divisionId, r]));
  const pending = refs.filter((ref) => needsReading(ref, byId.get(ref.id), reclassify));
  const summary: ClassifySummary = {
    pending: pending.length,
    read: 0,
    calls: 0,
    statuses: Object.fromEntries(DIVISION_MEANING_STATUSES.map((s) => [s, 0])) as Record<DivisionMeaningStatus, number>,
    promptTokens: 0,
    completionTokens: 0,
    readings: [],
  };
  for (const ref of limit === null ? pending : pending.slice(0, limit)) {
    const result = await readDivision(ref, byId.get(ref.id), complete, now);
    if (!result) continue;
    summary.read++;
    if (result.called) summary.calls++;
    summary.statuses[result.row.status]++;
    summary.promptTokens += result.answer?.promptTokens ?? 0;
    summary.completionTokens += result.answer?.completionTokens ?? 0;
    summary.readings.push(result.reading);
    if (!dryRun) await repo.upsertDivisionMeaning(result.row);
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

function meaningOf(row: DivisionIdeologyRow): DivisionMeaning {
  return {
    status: row.status,
    taLean: row.taLean ?? {},
    nilLean: row.nilLean ?? {},
    nilWeight: row.nilWeight ?? 1,
    confidence: row.confidence ?? 0,
    salience: row.salience ?? 0,
    policyTopic: row.policyTopic,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) out.set(key(item), [...(out.get(key(item)) ?? []), item]);
  return out;
}

export interface EvidenceSyncSummary {
  /** Divisions that gave at least one row. */
  divisions: number;
  rows: number;
  tds: number;
  parties: number;
}

/**
 * Every reading and every vote → the whole set of `division` evidence rows, capped per TD
 * (capDivisionWeights) and written in one transaction; then every TD and party is recomputed
 * from the committed rows. No model calls. Rows for TDs no longer in the Dáil are left out.
 */
export async function syncDivisionEvidence(now = new Date()): Promise<EvidenceSyncSummary> {
  const [records, meanings, active, refs] = await Promise.all([
    parliament.divisionVoteRecords(),
    repo.listDivisionMeanings(),
    repo.listActiveTds(),
    parliament.listDivisionRefs(),
  ]);
  const activeIds = new Set(active.map((t) => t.id));
  // A division with no debate section is its own section.
  const sectionOf = new Map(refs.map((d) => [d.id, d.debateSectionId ?? d.id]));
  const votesOf = groupBy(records, (r) => r.divisionId);
  const uncapped: Array<NewTdIdeologyEvidence & { section: string }> = [];
  let divisions = 0;
  for (const meaning of meanings) {
    const before = uncapped.length;
    for (const e of divisionEvidence(meaningOf(meaning), votesOf.get(meaning.divisionId) ?? [])) {
      if (!activeIds.has(e.tdId)) continue;
      const vector = toObservationVector('division', e.raw);
      if (!hasSignal(vector)) continue;
      const section = sectionOf.get(e.divisionId) ?? e.divisionId;
      uncapped.push({ tdId: e.tdId, source: 'division', sourceRef: e.divisionId, policyTopic: e.policyTopic, ...vector, weight: e.weight, observedAt: e.observedAt, section });
    }
    if (uncapped.length > before) divisions++;
  }
  const rows: NewTdIdeologyEvidence[] = capDivisionWeights(uncapped).map(({ section: _section, ...row }) => row);
  await repo.replaceDivisionEvidence(rows);
  const recomputed = await recomputeTdsAndParties(now);
  return { divisions, rows: rows.length, ...recomputed };
}

// ---------------------------------------------------------------------------
// The nightly run
// ---------------------------------------------------------------------------

/** Thrown when a run is already in flight in this process. */
export class DivisionIdeologyAlreadyRunning extends Error {}
let inFlight = false;

export interface DivisionIdeologyRun {
  /** null when no LLM is configured: nothing was read. */
  classify: ClassifySummary | null;
  evidence: EvidenceSyncSummary;
}

/** The nightly run: read at most NIGHTLY_LIMIT divisions (never re-reading), then sync evidence. */
export async function runDivisionIdeology(options: {
  mode: 'nightly';
  complete?: DivisionCompletion;
  llmConfigured?: boolean;
  now?: Date;
  log?: (line: string) => void;
}): Promise<DivisionIdeologyRun> {
  if (inFlight) throw new DivisionIdeologyAlreadyRunning('A division ideology run is already in flight');
  inFlight = true;
  try {
    const now = options.now ?? new Date();
    const log = options.log ?? ((line: string) => console.log(line));
    const classify = (options.llmConfigured ?? isLLMConfigured())
      ? await classifyDivisions({ limit: NIGHTLY_LIMIT, complete: options.complete, now })
      : null;
    const evidence = await syncDivisionEvidence(now);
    const read = classify
      ? `read ${classify.read} of ${classify.pending} division(s) (${DIVISION_MEANING_STATUSES.map((s) => `${s} ${classify.statuses[s]}`).join(', ')}), ` +
        `${classify.calls} model call(s), ${classify.promptTokens} prompt + ${classify.completionTokens} completion tokens`
      : 'no LLM configured, nothing read';
    log(`[division-ideology] ${read}; ${evidence.rows} evidence row(s) from ${evidence.divisions} division(s); recomputed ${evidence.tds} TDs and ${evidence.parties} parties.`);
    return { classify, evidence };
  } finally {
    inFlight = false;
  }
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

/** A dimension is checked only where the reading leans at least this much… */
export const AUDIT_MIN_LEAN = 0.5;
/** …and the lobbies' mean party baselines are at least this far apart (−10..+10). */
export const AUDIT_MIN_GAP = 2;
export const AUDIT_WORST = 20;

export interface AuditCount {
  agree: number;
  total: number;
}

export interface DivisionAudit {
  /** Divisions with at least one dimension checked. */
  divisions: number;
  agree: number;
  total: number;
  byDimension: Record<IdeologyDimension, AuditCount>;
  /** The divisions that disagree most, for a person to read. */
  worst: Array<{
    divisionId: string;
    taMeans: string | null;
    disagreements: Array<{ dimension: IdeologyDimension; taLean: number; nilLean: number; gap: number }>;
  }>;
}

type AuditReading = Pick<DivisionIdeologyRow, 'divisionId' | 'status' | 'taLean' | 'nilLean' | 'confidence' | 'taMeans'>;
type AuditVote = Pick<DivisionVoteRecord, 'divisionId' | 'party' | 'vote'>;

const emptyCounts = () => Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, { agree: 0, total: 0 }])) as Record<IdeologyDimension, AuditCount>;

/** Mean party baseline of one lobby on each dimension; null when no voter in it has a baseline. */
function lobbyMean(votes: AuditVote[]): Record<IdeologyDimension, number> | null {
  const baselines = votes.map((v) => partyBaseline(v.party)).filter((b) => b !== null);
  if (baselines.length === 0) return null;
  return Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, baselines.reduce((s, b) => s + b[d], 0) / baselines.length])) as Record<IdeologyDimension, number>;
}

/**
 * How often a reading points the same way as the vote. On each dimension where the reading
 * leans (|Tá| ≥ AUDIT_MIN_LEAN) and the Tá and Níl lobbies' mean party baselines differ by
 * at least AUDIT_MIN_GAP, sign(Tá − Níl) should match sign(Tá lobby − Níl lobby). The prompt
 * never sees how parties voted, so this is an independent check. Pure.
 */
export function auditDivisions(readings: AuditReading[], votes: AuditVote[]): DivisionAudit {
  const votesOf = groupBy(votes, (v) => v.divisionId);
  const byDimension = emptyCounts();
  const worst: DivisionAudit['worst'] = [];
  let divisions = 0;
  for (const r of readings) {
    if (r.status !== 'classified' || !((r.confidence ?? 0) >= MIN_DIVISION_CONFIDENCE)) continue;
    const lobby = votesOf.get(r.divisionId) ?? [];
    const ta = lobbyMean(lobby.filter((v) => v.vote === 'ta'));
    const nil = lobbyMean(lobby.filter((v) => v.vote === 'nil'));
    if (!ta || !nil) continue;
    const disagreements: DivisionAudit['worst'][number]['disagreements'] = [];
    let checked = 0;
    for (const d of IDEOLOGY_DIMENSIONS) {
      const taLean = r.taLean?.[d] ?? 0;
      const nilLean = r.nilLean?.[d] ?? 0;
      const gap = ta[d] - nil[d];
      if (Math.abs(taLean) < AUDIT_MIN_LEAN || Math.abs(gap) < AUDIT_MIN_GAP) continue;
      checked++;
      byDimension[d].total++;
      if (Math.sign(taLean - nilLean) === Math.sign(gap)) byDimension[d].agree++;
      else disagreements.push({ dimension: d, taLean, nilLean, gap: Math.round(gap * 100) / 100 });
    }
    if (checked > 0) divisions++;
    if (disagreements.length > 0) worst.push({ divisionId: r.divisionId, taMeans: r.taMeans, disagreements });
  }
  const gapOf = (w: DivisionAudit['worst'][number]) => w.disagreements.reduce((s, d) => s + Math.abs(d.gap), 0);
  worst.sort((a, b) => b.disagreements.length - a.disagreements.length || gapOf(b) - gapOf(a));
  const agree = IDEOLOGY_DIMENSIONS.reduce((s, d) => s + byDimension[d].agree, 0);
  const total = IDEOLOGY_DIMENSIONS.reduce((s, d) => s + byDimension[d].total, 0);
  return { divisions, agree, total, byDimension, worst: worst.slice(0, AUDIT_WORST) };
}

export interface ResampleSummary {
  divisions: number;
  /** Dimensions (|stored Tá lean| ≥ AUDIT_MIN_LEAN) whose sign a fresh reading kept. */
  stable: number;
  total: number;
  byDimension: Record<IdeologyDimension, { stable: number; total: number }>;
  /** Re-reads that failed (a thrown call or unusable output). */
  failed: number;
  promptTokens: number;
  completionTokens: number;
}

/**
 * The audit over every stored reading. With `resample`, also re-read that many random
 * classified divisions and report how often each dimension's sign held. Writes nothing.
 */
export async function runDivisionAudit(options: {
  resample?: number;
  complete?: DivisionCompletion;
  random?: () => number;
}): Promise<{ audit: DivisionAudit; resample: ResampleSummary | null }> {
  const { resample = 0, complete = divisionCompletion, random = Math.random } = options;
  const [readings, votes] = await Promise.all([repo.listDivisionMeanings(), parliament.divisionVoteRecords()]);
  const audit = auditDivisions(readings, votes);
  if (resample <= 0) return { audit, resample: null };

  const classified = readings.filter((r) => r.status === 'classified');
  const picked = classified
    .map((r) => ({ r, key: random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, resample)
    .map(({ r }) => r);
  const byDimension = Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, { stable: 0, total: 0 }])) as ResampleSummary['byDimension'];
  const summary: ResampleSummary = { divisions: 0, stable: 0, total: 0, byDimension, failed: 0, promptTokens: 0, completionTokens: 0 };
  for (const stored of picked) {
    const context = await parliament.divisionContext(stored.divisionId);
    if (!context) continue;
    summary.divisions++;
    let fresh: DivisionClassification | null = null;
    try {
      const answer = await complete(DIVISION_SYSTEM_PROMPT, divisionUserPrompt(context));
      summary.promptTokens += answer.promptTokens ?? 0;
      summary.completionTokens += answer.completionTokens ?? 0;
      fresh = parseDivisionClassification(answer.content);
    } catch {
      fresh = null;
    }
    if (!fresh) {
      summary.failed++;
      continue;
    }
    for (const d of IDEOLOGY_DIMENSIONS) {
      const was = stored.taLean?.[d] ?? 0;
      if (Math.abs(was) < AUDIT_MIN_LEAN) continue;
      byDimension[d].total++;
      summary.total++;
      if (Math.sign(fresh.taLean[d] ?? 0) === Math.sign(was)) {
        byDimension[d].stable++;
        summary.stable++;
      }
    }
  }
  return { audit, resample: summary };
}

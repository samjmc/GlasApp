/**
 * Step 2 of debate analysis: read argued debates for items (docs/plans/debate-analysis.md).
 *
 *   extractDebates   for each debate: windows of whole speeches → one model call each →
 *                    parseItems → verifyItems → its items and run stored together. A debate is
 *                    read once per EXTRACTOR_VERSION, and again only when its speeches change.
 *   pilotSample      a fixed, repeatable sample of argued debates across kinds.
 *
 * Every model call goes through an `ItemCompletion`, so tests never reach a model. Nothing here
 * scores anyone: items are shown and scored only after the check set (Step 3).
 */
import { createHash } from 'node:crypto';
import { debateItemKind, type DebateItemKind } from '@shared/schema/parliament';
import { callChatCompletion } from '../../services/aiService';
import * as repo from '../repository';
import type { ArguedDebate } from '../repo/debateItems';
import { EXTRACT_SYSTEM, EXTRACTOR_VERSION, extractPrompt, parseItems } from './prompt';
import { emptyRejections, REJECT_REASONS, verifyItems, type Rejections, type VerifiedItem } from './verify';
import { buildWindows, isIrish, labelSpeeches, splitWindow } from './windows';

/** The model asked for; a configured provider (DeepSeek) replaces it, so the answer's own model is stored. */
const ITEM_MODEL = 'gpt-4o-mini';

/**
 * deepseek-flash list prices, USD per million tokens, from api-docs.deepseek.com/quick_start/pricing
 * on 2026-10-04. Every input token is costed as a cache miss, so the estimate is an upper bound.
 */
export const PRICES = {
  offPeak: { input: 0.15, output: 0.6 },
  peak: { input: 0.3, output: 1.2 },
} as const;

export interface ItemAnswer {
  content: string | null;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  /** The reply stopped at the output limit, so its JSON is cut off. */
  truncated?: boolean;
}

/** One model call. Throws on failure, which records the debate's run as `failed`. */
export type ItemCompletion = (system: string, user: string) => Promise<ItemAnswer>;

/**
 * Waits after a 429 before trying again. DeepSeek caps concurrent requests per account by its
 * balance (10 on 2026-10-04), and other apps share the key: the second pilot run lost 22 of 50
 * debates to 429s when the client's own sub-second backoff gave up.
 */
const RATE_LIMIT_WAITS_MS = [5_000, 15_000, 45_000];

export const itemCompletion: ItemCompletion = async (system, user) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await completeOnce(system, user);
    } catch (error) {
      if ((error as { status?: number }).status !== 429 || attempt >= RATE_LIMIT_WAITS_MS.length) throw error;
      await new Promise((r) => setTimeout(r, RATE_LIMIT_WAITS_MS[attempt]));
    }
  }
};

async function completeOnce(system: string, user: string): Promise<ItemAnswer> {
  const response = await callChatCompletion(
    {
      model: ITEM_MODEL,
      temperature: 0,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    { timeoutMs: 180_000, retries: 1, operation: 'debate-items' },
  );
  return {
    content: response.choices[0]?.message.content ?? null,
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    truncated: response.choices[0]?.finish_reason === 'length',
  };
}

const hashOf = (parts: string[]) => createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
const rank = (id: string) => createHash('sha1').update(id).digest('hex');

/** Share of a pilot per kind: bill stages and motions are most of the argument, statements the rest. */
const PILOT_SHARES: Array<[ArguedDebate['kind'], number]> = [
  ['bill_stage', 0.4],
  ['motion', 0.4],
  ['statements', 0.2],
];

/** A fixed sample: per kind, the debates whose id hashes lowest. The same input gives the same sample. */
export function pilotSample(debates: ArguedDebate[], n: number): ArguedDebate[] {
  const out: ArguedDebate[] = [];
  for (const [kind, share] of PILOT_SHARES) {
    const take = kind === 'statements' ? n - out.length : Math.round(n * share);
    out.push(
      ...debates
        .filter((d) => d.kind === kind)
        .sort((a, b) => (rank(a.id) < rank(b.id) ? -1 : 1))
        .slice(0, take),
    );
  }
  return out;
}

/** JSON from a model reply, allowing a code fence around it. */
function parseJson(content: string | null): unknown {
  if (!content) return null;
  const body = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export interface DebateResult {
  id: string;
  title: string;
  kind: string;
  speeches: number;
  words: number;
  irishSpeeches: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  accepted: number;
  rejected: number;
  error: string | null;
}

export interface ExtractSummary {
  /** Debates chosen. */
  debates: number;
  done: number;
  failed: number;
  /** Already read by this version, with the same speeches. */
  skipped: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  words: number;
  speeches: number;
  irishSpeeches: number;
  acceptedByKind: Record<DebateItemKind, number>;
  rejected: Rejections;
  /** Entries of the wrong shape in a reply (not counted in `rejected`). */
  malformed: number;
  costUsd: { offPeak: number; peak: number };
  /** Items removed because their speech left the record (a corrected transcript). */
  orphansRemoved: number;
  /** Why the run stopped early, if it did: debates not started are not counted as failed. */
  stopped: string | null;
  results: DebateResult[];
}

/** The provider says the account has no credit: every later call would fail the same way. */
const OUT_OF_CREDIT = 402;

export interface ExtractOptions {
  /** These debates only. */
  debateIds?: string[];
  /** A fixed sample of this many argued debates (pilotSample). */
  pilot?: number | null;
  /** At most this many debates that need reading. */
  limit?: number | null;
  /** Read again even when this version already read the same speeches. */
  force?: boolean;
  /** Make the calls, write nothing. */
  dryRun?: boolean;
  /** Debates read at once. Windows within a debate are read one after another. */
  concurrency?: number;
  complete?: ItemCompletion;
  log?: (line: string) => void;
}

export const costOf = (promptTokens: number, completionTokens: number) => ({
  offPeak: (promptTokens * PRICES.offPeak.input + completionTokens * PRICES.offPeak.output) / 1e6,
  peak: (promptTokens * PRICES.peak.input + completionTokens * PRICES.peak.output) / 1e6,
});

export async function extractDebates(options: ExtractOptions = {}): Promise<ExtractSummary> {
  const { debateIds, pilot = null, limit = null, force = false, dryRun = false, concurrency = 2, complete = itemCompletion, log = () => {} } = options;
  const [all, runs, offices] = await Promise.all([repo.arguedDebates(), repo.extractionRunsFor(EXTRACTOR_VERSION), repo.governmentOffices()]);
  let chosen = debateIds ? all.filter((d) => debateIds.includes(d.id)) : pilot ? pilotSample(all, pilot) : all;
  if (limit !== null) chosen = chosen.slice(0, limit);

  const summary: ExtractSummary = {
    debates: chosen.length,
    done: 0,
    failed: 0,
    skipped: 0,
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    words: 0,
    speeches: 0,
    irishSpeeches: 0,
    acceptedByKind: Object.fromEntries(debateItemKind.enumValues.map((k) => [k, 0])) as Record<DebateItemKind, number>,
    rejected: emptyRejections(),
    malformed: 0,
    costUsd: { offPeak: 0, peak: 0 },
    orphansRemoved: 0,
    stopped: null,
    results: [],
  };

  const readOne = async (debate: ArguedDebate) => {
    const speeches = labelSpeeches(await repo.debateSpeechesOf(debate.id));
    // Ids and full text: a corrected word changes the hash, so its quote offsets are never stale.
    const inputHash = hashOf(speeches.map((s) => `${s.id}\u0000${s.text}`));
    const prior = runs.get(debate.id);
    if (!force && prior?.status === 'done' && prior.inputHash === inputHash) {
      summary.skipped++;
      return;
    }
    const result: DebateResult = {
      id: debate.id,
      title: debate.title,
      kind: debate.kind,
      speeches: speeches.length,
      words: speeches.reduce((n, s) => n + s.wordCount, 0),
      irishSpeeches: speeches.filter((s) => isIrish(s.text)).length,
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      accepted: 0,
      rejected: 0,
      error: null,
    };
    const items: VerifiedItem[] = [];
    const rejected = emptyRejections();
    let model: string | null = null;
    const windows = buildWindows(speeches);
    while (windows.length > 0) {
      const window = windows.shift()!;
      result.calls++;
      let answer: ItemAnswer;
      try {
        answer = await complete(EXTRACT_SYSTEM, extractPrompt(debate.title, window));
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        if ((error as { status?: number }).status === OUT_OF_CREDIT) summary.stopped = `the model provider has no credit left (${result.error})`;
        break;
      }
      model = answer.model.slice(0, 60);
      result.promptTokens += answer.promptTokens ?? 0;
      result.completionTokens += answer.completionTokens ?? 0;
      const parsed = parseItems(parseJson(answer.content));
      if (!parsed) {
        // A reply cut off at the output limit is the same at temperature 0 every time it is
        // asked, so read the window again in two halves (3 debates of 445 on 2026-10-04).
        const halves = answer.truncated ? splitWindow(window) : null;
        if (halves) {
          windows.unshift(...halves);
          continue;
        }
        result.error = answer.truncated ? 'model output cut off at the token limit' : 'unusable model output';
        break;
      }
      summary.malformed += parsed.malformed;
      const checked = verifyItems(parsed.items, window, offices);
      items.push(...checked.accepted);
      for (const reason of REJECT_REASONS) {
        rejected[reason].en += checked.rejected[reason].en;
        rejected[reason].ga += checked.rejected[reason].ga;
      }
    }
    result.accepted = result.error ? 0 : items.length;
    result.rejected = REJECT_REASONS.reduce((n, r) => n + rejected[r].en + rejected[r].ga, 0);

    summary.calls += result.calls;
    summary.promptTokens += result.promptTokens;
    summary.completionTokens += result.completionTokens;
    summary.words += result.words;
    summary.speeches += result.speeches;
    summary.irishSpeeches += result.irishSpeeches;
    if (result.error) summary.failed++;
    else {
      summary.done++;
      for (const item of items) summary.acceptedByKind[item.kind]++;
      for (const reason of REJECT_REASONS) {
        summary.rejected[reason].en += rejected[reason].en;
        summary.rejected[reason].ga += rejected[reason].ga;
      }
    }
    summary.results.push(result);
    log(`${result.error ? 'FAILED' : 'done'} ${debate.kind} "${debate.title.slice(0, 60)}": ${result.words} words, ${result.calls} call(s), ${result.accepted} items, ${result.rejected} rejected${result.error ? ` (${result.error})` : ''}`);

    if (dryRun) return;
    await repo.saveExtraction(
      {
        debateId: debate.id,
        extractorVersion: EXTRACTOR_VERSION,
        inputHash,
        status: result.error ? 'failed' : 'done',
        speeches: result.speeches,
        words: result.words,
        irishSpeeches: result.irishSpeeches,
        calls: result.calls,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        accepted: result.accepted,
        rejected: Object.fromEntries(REJECT_REASONS.filter((r) => rejected[r].en + rejected[r].ga > 0).map((r) => [r, rejected[r]])),
        model,
        error: result.error,
      },
      speeches.map((s) => s.id),
      result.error ? null : items.map((i) => ({ ...i, extractorVersion: EXTRACTOR_VERSION })),
    );
  };

  // A small pool: `concurrency` debates in flight at once.
  const queue = [...chosen];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
      for (let next = queue.shift(); next && !summary.stopped; next = queue.shift()) await readOne(next);
    }),
  );
  summary.costUsd = costOf(summary.promptTokens, summary.completionTokens);
  if (!dryRun) summary.orphansRemoved = await repo.deleteOrphanItems();
  return summary;
}

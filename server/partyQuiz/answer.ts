/**
 * A party takes the quiz: one LLM call per (party, question), answers verified against the
 * stored text and merged into the party's sheet for review.
 *
 * Nothing is spent without --yes: the token and cost estimate is always printed first. Only a
 * DeepSeek provider is accepted (its prefix cache is what keeps a run cheap), and only
 * documents whose sha256, word count and licence check are in the registry are read.
 * --control and --shuffle-check are probes: they print a result and write no sheet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PartyQuizItem, PartyQuizSheet } from '@shared/partyQuiz';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { callChatCompletion, chatProviderFrom, type ChatProvider } from '../services/aiService';
import type { StoredPage } from './extract';
import { answerQuestion, type AnswerContext } from './parse';
import { isCurrent } from './position';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildMessages,
  documentsBlock,
  questionBlock,
  shuffledOrder,
  type ChatMessage,
} from './prompt';
import { REGISTRY, documentsFor, type ManifestoDocument } from './registry';
import { validateSheet } from './sheet';
import { readSheet, writeSheet } from './sheetFiles';
import { TextStore } from './store';

export const MODEL = 'deepseek-flash';
export const CONCURRENCY = 4;
/** The estimate: no tokenizer here, so characters ÷ 3. The first real call logs the true count. */
export const CHARS_PER_TOKEN = 3;
/** Guard on one party's documents; deepseek-flash's context size is not stated in this repo. */
export const MAX_PARTY_TOKENS = 400_000;
/** Assumed completion tokens per call, for the estimate only. */
export const ESTIMATED_OUTPUT_TOKENS = 400;
/**
 * USD per million tokens: DeepSeek's list prices as the plan assumed them. Check the current
 * prices before the first run; the job prints the actual cost from the returned usage.
 */
export const PRICE_PER_MILLION = { cacheHit: 0.028, cacheMiss: 0.28, output: 0.42 };
export const CONTROL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'control.txt');

export type ChatCall = typeof callChatCompletion;

export interface AnswerOptions {
  party: string;
  questions?: number[];
  missing?: boolean;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  shuffleCheck?: boolean;
  control?: boolean;
}

export interface AnswerDeps {
  call?: ChatCall;
  /** Defaults to the configured provider; null = none configured. */
  provider?: ChatProvider | null;
  registry?: ManifestoDocument[];
  store?: Pick<TextStore, 'read'>;
  bank?: QuizQuestion[];
  sheetsDir?: string;
  log?: (line: string) => void;
}

export interface Usage {
  prompt: number;
  completion: number;
  cacheHit: number;
  cacheMiss: number;
}

export interface AnswerSummary {
  asked: number;
  failures: string[];
  usage: Usage;
  costUsd: number;
  model: string | null;
  /** validateSheet on the written sheet; empty when it may be committed. */
  problems: string[];
}

/** DeepSeek adds these to `usage`; they are not in the OpenAI types. */
type DeepSeekUsage = { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number };

export function costOf(u: Usage): number {
  // A provider that reports no cache split is priced as all misses.
  const miss = u.cacheHit + u.cacheMiss > 0 ? u.cacheMiss : u.prompt;
  return (u.cacheHit * PRICE_PER_MILLION.cacheHit + miss * PRICE_PER_MILLION.cacheMiss + u.completion * PRICE_PER_MILLION.output) / 1e6;
}

/** The negative control: invented text that takes no position, one page per paragraph. */
export function controlDocument(text = fs.readFileSync(CONTROL_FILE, 'utf8')): { slug: string; pages: StoredPage[] } {
  const body = text.replace(/\r\n/g, '\n').split('\n').filter((l) => !l.startsWith('#')).join('\n');
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { slug: 'control', pages: paragraphs.map((t, i) => ({ ordinal: i + 1, label: null, heading: null, text: t })) };
}

/** Keeps a reviewer's approval only if the answer is the same: status, index and quote shas. */
export function keepApproval(previous: PartyQuizItem | undefined, fresh: PartyQuizItem): PartyQuizItem {
  if (previous?.review !== 'approved') return fresh;
  const shas = (i: PartyQuizItem) => i.quotes.map((q) => q.quoteSha).sort().join(',');
  const same = previous.status === fresh.status && previous.answerIndex === fresh.answerIndex && shas(previous) === shas(fresh);
  return same ? { ...fresh, review: 'approved' } : fresh;
}

async function inPool<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await run(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

export async function runAnswer(opts: AnswerOptions, deps: AnswerDeps = {}): Promise<AnswerSummary> {
  const log = deps.log ?? console.log;
  const bank = deps.bank ?? QUIZ_QUESTIONS;
  const byId = new Map(bank.map((q) => [q.id, q] as const));
  const registry = deps.registry ?? REGISTRY;

  const docs = documentsFor(opts.party, registry).filter((d) => d.election === 'ge2024');
  if (docs.length === 0) throw new Error(`No ge2024 document in the registry for party "${opts.party}"`);
  const party = docs[0]!.party;

  let promptDocs: Array<{ slug: string; pages: StoredPage[] }>;
  if (opts.control) {
    promptDocs = [controlDocument()];
  } else {
    const store = deps.store ?? new TextStore();
    promptDocs = docs.map((d) => {
      if (!d.sha256 || !d.wordCount || !d.licenceChecked) {
        throw new Error(`${d.slug}: refused until registry.ts has its sha256, wordCount and licenceChecked: true (docs/architecture/party-quiz.md)`);
      }
      const stored = store.read(d.sha256);
      if (!stored) throw new Error(`${d.slug}: ${d.sha256} is not in the text store; run \`npm run party-quiz -- ingest --doc ${d.slug} --file <path>\``);
      return { slug: d.slug, pages: stored.pages };
    });
  }

  const existing = readSheet(party, 'ge2024', deps.sheetsDir);
  const unknown = (opts.questions ?? []).filter((id) => !byId.has(id));
  if (unknown.length) throw new Error(`Not in the bank: ${unknown.join(', ')}`);
  let selected = opts.questions ? bank.filter((q) => opts.questions!.includes(q.id)) : bank;
  if (opts.shuffleCheck) {
    if (!existing) throw new Error(`--shuffle-check compares with ${party}'s sheet, and there is none yet`);
    selected = selected.filter((q) => existing.items.some((i) => i.questionId === q.id && isCurrent(i, byId)));
  } else if (!opts.control && existing) {
    if (opts.missing) selected = selected.filter((q) => !existing.items.some((i) => i.questionId === q.id && isCurrent(i, byId)));
    else if (!opts.force) throw new Error(`${party} already has a sheet: pass --missing to answer only new or changed questions, or --force to ask again`);
  }

  const prefixChars = SYSTEM_PROMPT.length + documentsBlock(promptDocs).length;
  const prefixTokens = Math.ceil(prefixChars / CHARS_PER_TOKEN);
  if (prefixTokens > MAX_PARTY_TOKENS) {
    throw new Error(`${party}'s documents are about ${prefixTokens} tokens, over the ${MAX_PARTY_TOKENS} guard`);
  }
  const tokensFor = (q: QuizQuestion) => Math.ceil((prefixChars + questionBlock(q).length + 2) / CHARS_PER_TOKEN);
  const promptTokens = selected.reduce((n, q) => n + tokensFor(q), 0);
  const estimate = costOf({ prompt: promptTokens, completion: selected.length * ESTIMATED_OUTPUT_TOKENS, cacheHit: 0, cacheMiss: promptTokens });
  log(
    `${party}${opts.control ? ' (negative control)' : ''}: ${selected.length} question(s), about ${prefixTokens} document tokens per call, ` +
      `${promptTokens} prompt tokens in all; estimated cost without cache $${estimate.toFixed(4)} ` +
      `(assumed USD per 1M tokens: miss ${PRICE_PER_MILLION.cacheMiss}, hit ${PRICE_PER_MILLION.cacheHit}, output ${PRICE_PER_MILLION.output}).`,
  );
  const usage: Usage = { prompt: 0, completion: 0, cacheHit: 0, cacheMiss: 0 };
  const summary: AnswerSummary = { asked: 0, failures: [], usage, costUsd: 0, model: null, problems: [] };
  if (selected.length === 0) {
    log('Nothing to ask.');
    return summary;
  }
  if (opts.dryRun || !opts.yes) {
    log(opts.dryRun ? 'Dry run: no call made.' : 'No call made: pass --yes to spend.');
    return summary;
  }

  const provider = deps.provider !== undefined ? deps.provider : chatProviderFrom(process.env);
  if (provider?.name !== 'deepseek') {
    throw new Error('The party quiz runs only on DeepSeek (its prefix cache keeps a run cheap): set LLM_API_KEY, with LLM_BASE_URL unset or a DeepSeek URL');
  }
  if (provider.model && provider.model !== MODEL) log(`Note: LLM_MODEL_NAME forces ${provider.model}, not ${MODEL}; the sheet records the model that answers.`);

  const call = deps.call ?? callChatCompletion;
  const models = new Set<string>();
  let calls = 0;
  const ask = async (messages: ChatMessage[]): Promise<string> => {
    const n = ++calls;
    const completion = await call(
      { model: MODEL, temperature: 0, response_format: { type: 'json_object' }, messages },
      { operation: 'partyQuiz.answer', timeoutMs: 120_000, retries: 1 },
    );
    const u = (completion.usage ?? {}) as DeepSeekUsage;
    usage.prompt += u.prompt_tokens ?? 0;
    usage.completion += u.completion_tokens ?? 0;
    usage.cacheHit += u.prompt_cache_hit_tokens ?? 0;
    usage.cacheMiss += u.prompt_cache_miss_tokens ?? 0;
    models.add(completion.model);
    if (n === 1) log(`Call 1: prompt_tokens=${u.prompt_tokens ?? 'n/a'}, estimated ${tokensFor(selected[0]!)}; use it to calibrate CHARS_PER_TOKEN.`);
    if (n === 2 && !((u.prompt_cache_hit_tokens ?? 0) > 0)) log('Warning: call 2 had 0 cache-hit tokens; the document prefix is not being cached, so this run costs the uncached estimate.');
    return completion.choices[0]?.message?.content ?? '';
  };

  const pages = new Map(promptDocs.map((d) => [d.slug, d.pages] as const));
  const results = new Map<number, PartyQuizItem>();
  const runOne = async (question: QuizQuestion) => {
    const order = opts.shuffleCheck ? shuffledOrder(question) : undefined;
    const ctx: AnswerContext = { question, docs: pages, order };
    try {
      const result = await answerQuestion(ask, buildMessages(promptDocs, question, order), ctx);
      if ('item' in result) results.set(question.id, result.item);
      else summary.failures.push(`Q${question.id}: ${result.failure}`);
    } catch (error) {
      summary.failures.push(`Q${question.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  // The first call alone writes the prefix to the cache; the rest then read it.
  await runOne(selected[0]!);
  await inPool(selected.slice(1), CONCURRENCY, runOne);

  summary.asked = selected.length;
  summary.costUsd = costOf(usage);
  summary.model = Array.from(models)[0] ?? null;
  if (models.size > 1) log(`Warning: answers came from more than one model: ${Array.from(models).join(', ')}`);
  log(`${calls} call(s): prompt ${usage.prompt} tokens (cache hit ${usage.cacheHit}, miss ${usage.cacheMiss}), completion ${usage.completion}; actual cost $${summary.costUsd.toFixed(4)}.`);
  for (const failure of summary.failures) log(`Failed, not written: ${failure}`);

  const fresh = Array.from(results.values());
  if (opts.control) {
    const answered = fresh.filter((i) => i.status === 'answered');
    log(`Negative control: ${fresh.length - answered.length} of ${fresh.length} abstained (must be all).${answered.length ? ` Answered: ${answered.map((i) => `Q${i.questionId}`).join(', ')}` : ''}`);
    return summary;
  }
  if (opts.shuffleCheck) {
    const same = fresh.filter((i) => {
      const was = existing!.items.find((e) => e.questionId === i.questionId)!;
      return was.status === i.status && was.answerIndex === i.answerIndex;
    });
    log(`Shuffle check: ${same.length} of ${fresh.length} identical to the sheet (need at least 90%).`);
    return summary;
  }

  const items = new Map((existing?.items ?? []).map((i) => [i.questionId, i] as const));
  for (const item of fresh) items.set(item.questionId, keepApproval(items.get(item.questionId), item));
  const sheet: PartyQuizSheet = {
    party,
    election: 'ge2024',
    documents: docs.map((d) => d.slug),
    model: summary.model ?? existing?.model ?? MODEL,
    promptVersion: PROMPT_VERSION,
    items: Array.from(items.values()).sort((a, b) => a.questionId - b.questionId),
  };
  const file = writeSheet(sheet, deps.sheetsDir);
  summary.problems = validateSheet(sheet, registry);
  log(`Wrote ${file}: ${fresh.length} item(s) answered this run, ${sheet.items.length} in the sheet.`);
  for (const p of summary.problems) log(`Sheet problem: ${p}`);
  return summary;
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartyQuizItem } from '@shared/partyQuiz';
import type { QuizQuestion } from '@shared/quiz';
import type { ChatProvider } from '../services/aiService';
import { questionFingerprint } from '../quiz/fingerprint';
import { consensusItem, controlDocument, runAnswer, type AnswerDeps, type ChatCall } from './answer';
import { quoteSha } from './normalise';
import { PROMPT_VERSION, shuffledOrder } from './prompt';
import type { ManifestoDocument } from './registry';
import { readSheet, writeSheet } from './sheetFiles';
import { TextStore, sha256Of } from './store';

// Invented bank, document and quotes: no manifesto is quoted in this repo.
const BANK: QuizQuestion[] = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1, dimension: 'environmental', text: `Invented question ${i + 1}?`,
  answers: ['A', 'B', 'C', 'D'].map((a, v) => ({ value: v - 1.5, text: `Answer ${a}`, description: `Reason ${a}` })),
}));
const QUOTE_A = 'We will pay a warden for every river in every county';
const QUOTE_B = 'Every village library will open on Sunday afternoons with volunteer help';
const BYTES = new TextEncoder().encode('%PDF invented');
const DEEPSEEK: ChatProvider = { name: 'deepseek', apiKey: 'test', baseURL: 'https://api.deepseek.com', model: 'deepseek-flash', extraBody: {} };

let root: string;
let store: TextStore;
let registry: ManifestoDocument[];
let sheetsDir: string;
let lines: string[];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-quiz-answer-'));
  store = new TextStore(path.join(root, 'store'));
  store.save({
    slug: 'x-ge2024', format: 'pdf', bytes: BYTES, extractor: 'test',
    pages: [{ ordinal: 1, label: '1', heading: null, text: `${QUOTE_A} by the end of the term. ${QUOTE_B}.` }],
  });
  registry = [{
    slug: 'x-ge2024', party: 'Green Party', election: 'ge2024', title: 'Invented', url: 'https://example.ie/x.pdf', mirrorUrl: null,
    format: 'pdf', sha256: sha256Of(BYTES), wordCount: 20_000, retrieved: '2026-09-26', licenceChecked: true,
  }];
  sheetsDir = path.join(root, 'sheets');
  lines = [];
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

/** A reply per question id, read back from the question block at the end of the prompt. */
type Answer = { index: number; quote: string };
function fakeCall(answerFor: (id: number, prompt: string) => Answer, opts: { hit?: (n: number) => number; delayMs?: number } = {}) {
  const events: string[] = [];
  let n = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const call = vi.fn<ChatCall>(async (params) => {
    const seq = ++n;
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    events.push(`start ${seq}`);
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 0));
    const user = params.messages[1]!.content as string;
    const id = Number(/Invented question (\d+)\?/.exec(user)![1]);
    const { index, quote } = answerFor(id, user);
    events.push(`end ${seq}`);
    inFlight--;
    return {
      id: 'x', object: 'chat.completion', created: 0, model: 'deepseek-flash-0925',
      choices: [{ index: 0, finish_reason: 'stop', logprobs: null, message: { role: 'assistant', refusal: null, content: JSON.stringify({
        quotes: [{ document: 'x-ge2024', page: 1, text: quote }], rationale: 'Invented.', status: 'answered', answerIndex: index, abstainReason: null, confidence: 0.9,
      }) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 40, total_tokens: 1040, prompt_cache_hit_tokens: opts.hit?.(seq) ?? (seq > 1 ? 900 : 0), prompt_cache_miss_tokens: 1000 - (opts.hit?.(seq) ?? (seq > 1 ? 900 : 0)) },
    } as Awaited<ReturnType<ChatCall>>;
  });
  return { call, events, maxInFlight: () => maxInFlight };
}

const deps = (call: ChatCall, over: Partial<AnswerDeps> = {}): AnswerDeps => ({
  call, provider: DEEPSEEK, registry, store, bank: BANK, sheetsDir, log: (l) => lines.push(l), ...over,
});
const always = (index = 0, quote = QUOTE_A) => () => ({ index, quote });

describe('consensusItem', () => {
  const reading = (over: Partial<PartyQuizItem> = {}): PartyQuizItem => ({
    questionId: 1, fingerprint: '0000abcd', status: 'answered', answerIndex: 1, abstainReason: null,
    quotes: [{ document: 'x-ge2024', page: 1, pageLabel: '1', text: QUOTE_A, quoteSha: quoteSha(QUOTE_A) }],
    rationale: 'Invented.', modelConfidence: 0.8, review: 'pending', ...over,
  });
  const abstained = (over: Partial<PartyQuizItem> = {}) =>
    reading({ status: 'abstained', answerIndex: null, abstainReason: 'silent', quotes: [], ...over });

  it('keeps the first reading, with the lower confidence, when both give the same answer', () => {
    const merged = consensusItem(reading({ modelConfidence: 0.9 }), reading({ modelConfidence: 0.6, rationale: 'Other.' }));
    expect(merged).toEqual(reading({ modelConfidence: 0.6 }));
  });

  it('abstains as low_confidence, keeping the first leaning, when the two answers differ', () => {
    const merged = consensusItem(reading({ answerIndex: 1 }), reading({ answerIndex: 2, modelConfidence: 0.7 }));
    expect(merged).toMatchObject({ status: 'abstained', answerIndex: null, abstainReason: 'low_confidence', tentativeAnswerIndex: 1, quotes: [], modelConfidence: 0.7 });
  });

  it('abstains when only one reading answers, keeping that answer as the leaning', () => {
    expect(consensusItem(reading({ answerIndex: 3 }), abstained())).toMatchObject({ status: 'abstained', abstainReason: 'low_confidence', tentativeAnswerIndex: 3 });
    expect(consensusItem(abstained(), reading({ answerIndex: 2 }))).toMatchObject({ status: 'abstained', abstainReason: 'low_confidence', tentativeAnswerIndex: 2 });
  });

  it('treats a low_confidence abstention as an abstention', () => {
    const lowConfidence = abstained({ abstainReason: 'low_confidence', tentativeAnswerIndex: 1 });
    expect(consensusItem(reading({ answerIndex: 1 }), lowConfidence)).toMatchObject({ status: 'abstained', abstainReason: 'low_confidence', tentativeAnswerIndex: 1 });
    expect(consensusItem(lowConfidence, lowConfidence)).toBe(lowConfidence);
  });

  it('keeps a shared abstention as the first reading gave it', () => {
    const first = abstained({ abstainReason: 'silent' });
    expect(consensusItem(first, abstained({ abstainReason: 'no_preference' }))).toBe(first);
  });
});

describe('runAnswer', () => {
  it('prints the estimate and makes no call without --yes, or with --dry-run', async () => {
    const { call } = fakeCall(always());
    await runAnswer({ party: 'Green Party' }, deps(call));
    await runAnswer({ party: 'Green Party', yes: true, dryRun: true }, deps(call));
    expect(call).not.toHaveBeenCalled();
    expect(lines.filter((l) => /estimated cost without cache \$\d/.test(l))).toHaveLength(2);
    expect(readSheet('Green Party', 'ge2024', sheetsDir)).toBeNull();
  });

  it('runs the first call alone to warm the cache, then 4 at a time', async () => {
    const { call, events, maxInFlight } = fakeCall(always(), { delayMs: 5 });
    await runAnswer({ party: 'Green Party', yes: true }, deps(call));
    expect(call).toHaveBeenCalledTimes(9);
    expect(events.slice(0, 3)).toEqual(['start 1', 'end 1', 'start 2']);
    expect(maxInFlight()).toBe(4);
  });

  it('records the model that actually answered and the prompt version in the sheet', async () => {
    const { call } = fakeCall(always());
    const summary = await runAnswer({ party: 'green', yes: true }, deps(call));
    const sheet = readSheet('Green Party', 'ge2024', sheetsDir)!;
    expect(sheet).toMatchObject({ party: 'Green Party', documents: ['x-ge2024'], model: 'deepseek-flash-0925', promptVersion: PROMPT_VERSION });
    expect(sheet.items.map((i) => [i.questionId, i.answerIndex, i.review])).toEqual(BANK.map((q) => [q.id, 0, 'pending']));
    expect(summary.problems).toEqual([]);
  });

  it('sums cache hit and miss tokens, and warns when call 2 had no cache hits', async () => {
    const warm = fakeCall(always());
    const summary = await runAnswer({ party: 'Green Party', yes: true }, deps(warm.call));
    expect(summary.usage).toEqual({ prompt: 9000, completion: 360, cacheHit: 8 * 900, cacheMiss: 1000 + 8 * 100 });
    expect(summary.costUsd).toBeCloseTo((7200 * 0.028 + 1800 * 0.28 + 360 * 0.42) / 1e6, 10);
    expect(lines.some((l) => /call 2 had 0 cache-hit tokens/.test(l))).toBe(false);

    lines = [];
    const cold = fakeCall(always(), { hit: () => 0 });
    await runAnswer({ party: 'Green Party', yes: true, force: true }, deps(cold.call));
    expect(lines.filter((l) => /call 2 had 0 cache-hit tokens/.test(l))).toHaveLength(1);
  });

  it('refuses a chat provider that is not DeepSeek', async () => {
    const { call } = fakeCall(always());
    const openai: ChatProvider = { name: 'openai', apiKey: 'test', model: null, extraBody: {} };
    await expect(runAnswer({ party: 'Green Party', yes: true }, deps(call, { provider: openai }))).rejects.toThrow(/DeepSeek/);
    await expect(runAnswer({ party: 'Green Party', yes: true }, deps(call, { provider: null }))).rejects.toThrow(/DeepSeek/);
    expect(call).not.toHaveBeenCalled();
  });

  it('refuses a document whose licence has not been checked, even for a dry run', async () => {
    const { call } = fakeCall(always());
    registry[0]!.licenceChecked = false;
    await expect(runAnswer({ party: 'Green Party', yes: true }, deps(call))).rejects.toThrow(/licenceChecked/);
    await expect(runAnswer({ party: 'Green Party', dryRun: true }, deps(call))).rejects.toThrow(/licenceChecked/);
    expect(call).not.toHaveBeenCalled();
  });

  it('keeps an approval only when the status, answer and quote shas are unchanged', async () => {
    const approved = (questionId: number, quote: string): PartyQuizItem => ({
      questionId, fingerprint: questionFingerprint(BANK[questionId - 1]!), status: 'answered', answerIndex: 0, abstainReason: null,
      quotes: [{ document: 'x-ge2024', page: 1, pageLabel: '1', text: quote, quoteSha: quoteSha(quote) }],
      rationale: 'Invented.', modelConfidence: 0.9, review: 'approved',
    });
    writeSheet({ party: 'Green Party', election: 'ge2024', documents: ['x-ge2024'], model: 'm', promptVersion: 'v0', items: [approved(1, QUOTE_A), approved(2, QUOTE_A), approved(3, QUOTE_A)] }, sheetsDir);
    const { call } = fakeCall((id) => (id === 2 ? { index: 1, quote: QUOTE_A } : id === 3 ? { index: 0, quote: QUOTE_B } : { index: 0, quote: QUOTE_A }));

    await expect(runAnswer({ party: 'Green Party', yes: true, questions: [1, 2, 3] }, deps(call))).rejects.toThrow(/--missing|--force/);
    await runAnswer({ party: 'Green Party', yes: true, force: true, questions: [1, 2, 3] }, deps(call));
    const items = readSheet('Green Party', 'ge2024', sheetsDir)!.items;
    expect(items.map((i) => [i.questionId, i.answerIndex, i.review])).toEqual([[1, 0, 'approved'], [2, 1, 'pending'], [3, 0, 'pending']]);
  });

  it('with --missing asks only questions with no current item', async () => {
    const { call } = fakeCall(always());
    await runAnswer({ party: 'Green Party', yes: true, questions: [1, 2] }, deps(call));
    call.mockClear();
    await runAnswer({ party: 'Green Party', yes: true, missing: true }, deps(call));
    expect(call).toHaveBeenCalledTimes(7);
    expect(readSheet('Green Party', 'ge2024', sheetsDir)!.items).toHaveLength(9);
  });

  it('with --consensus asks every question twice and keeps answers that do not depend on the answer order', () => {
    // A model that answers by meaning: it finds "Answer B" wherever the prompt shows it.
    const byMeaning = (_id: number, prompt: string) => ({ index: Number(/^(\d+)\. Answer B$/m.exec(prompt)![1]), quote: QUOTE_A });
    const { call } = fakeCall(byMeaning);
    return runAnswer({ party: 'Green Party', yes: true, consensus: true }, deps(call)).then(() => {
      expect(call).toHaveBeenCalledTimes(18);
      const items = readSheet('Green Party', 'ge2024', sheetsDir)!.items;
      expect(items.map((i) => [i.status, i.answerIndex])).toEqual(BANK.map(() => ['answered', 1]));
    });
  });

  it('with --consensus drops an answer the model gives by position, not by meaning', async () => {
    // A model that always picks whatever is shown first: it agrees with itself only if the shuffle keeps that option first.
    const { call } = fakeCall(always(0));
    await runAnswer({ party: 'Green Party', yes: true, consensus: true }, deps(call));
    const items = readSheet('Green Party', 'ge2024', sheetsDir)!.items;
    const stable = BANK.filter((q) => shuffledOrder(q)[0] === 0).map((q) => q.id);
    expect(stable.length).toBeLessThan(BANK.length); // the shuffle moves the first option for some question
    for (const item of items) {
      if (stable.includes(item.questionId)) expect(item).toMatchObject({ status: 'answered', answerIndex: 0 });
      else expect(item).toMatchObject({ status: 'abstained', answerIndex: null, abstainReason: 'low_confidence', tentativeAnswerIndex: 0 });
    }
  });

  it('with --consensus prints an estimate for two passes, and refuses to go with --shuffle-check or --control', async () => {
    const { call } = fakeCall(always());
    await runAnswer({ party: 'Green Party', dryRun: true }, deps(call));
    await runAnswer({ party: 'Green Party', dryRun: true, consensus: true }, deps(call));
    const tokens = lines.map((l) => /(\d+) prompt tokens in all/.exec(l)?.[1]).filter(Boolean).map(Number);
    expect(tokens).toHaveLength(2);
    expect(tokens[1]).toBe(2 * tokens[0]!);
    await expect(runAnswer({ party: 'Green Party', yes: true, consensus: true, shuffleCheck: true }, deps(call))).rejects.toThrow(/--consensus/);
    await expect(runAnswer({ party: 'Green Party', yes: true, consensus: true, control: true }, deps(call))).rejects.toThrow(/--consensus/);
    expect(call).not.toHaveBeenCalled();
  });

  it('--shuffle-check splits its result by what the sheet says: kept answers, and abstentions', async () => {
    const answered = (questionId: number, answerIndex: number): PartyQuizItem => ({
      questionId, fingerprint: questionFingerprint(BANK[questionId - 1]!), status: 'answered', answerIndex, abstainReason: null,
      quotes: [{ document: 'x-ge2024', page: 1, pageLabel: '1', text: QUOTE_A, quoteSha: quoteSha(QUOTE_A) }],
      rationale: 'Invented.', modelConfidence: 0.9, review: 'pending',
    });
    const silent: PartyQuizItem = { ...answered(3, 0), status: 'abstained', answerIndex: null, abstainReason: 'silent', quotes: [] };
    writeSheet({
      party: 'Green Party', election: 'ge2024', documents: ['x-ge2024'], model: 'm', promptVersion: 'v0',
      items: [answered(1, 1), answered(2, 2), silent, answered(4, 1)],
    }, sheetsDir);
    // The model answers "Answer B" wherever it is shown, except Q4, where its quote is not in the document.
    const { call } = fakeCall((id, prompt) => ({
      index: Number(/^(\d+)\. Answer B$/m.exec(prompt)![1]),
      quote: id === 4 ? 'A sentence that is nowhere in this document at all' : QUOTE_A,
    }));
    await runAnswer({ party: 'Green Party', yes: true, shuffleCheck: true, questions: [1, 2, 3, 4] }, deps(call));
    expect(lines).toContain('Shuffle check: 1 of 4 identical to the sheet (need at least 90%).');
    expect(lines).toContain('Of 3 answered item(s) on the sheet: 1 the same, 1 a different answer, 1 now an abstention. Of 1 abstained: 1 now answered.');
  });

  it('reads the negative control from the fixture, without its comment lines', () => {
    const control = controlDocument();
    expect(control.slug).toBe('control');
    expect(control.pages.length).toBeGreaterThanOrEqual(3);
    expect(control.pages.map((p) => p.text).join(' ')).not.toMatch(/#|negative control/);
  });
});

import { describe, expect, it, vi } from 'vitest';

const llm = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../services/aiService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/aiService')>()),
  isLLMConfigured: () => true,
  callChatCompletion: llm.call,
}));

const { RELEVANCE_BATCH_SIZE, SUMMARY_MAX_WORDS, buildPrompt, parseRelevance, scoreRelevance } = await import('./relevance');
const { MAX_CONCURRENT_CALLS, OutOfCreditError } = await import('../services/aiService');

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `t${i}`, summary: null, source: 's' }));
const reply = (count: number) => ({
  choices: [{ message: { content: JSON.stringify({ items: Array.from({ length: count }, (_, i) => ({ i, relevance: 70, category: 'eu', summary: 's' })) }) } }],
});

describe('scoreRelevance', () => {
  it(`sends at most ${MAX_CONCURRENT_CALLS} batches at once, however many there are`, async () => {
    let now = 0;
    let most = 0;
    llm.call.mockReset().mockImplementation(async () => {
      most = Math.max(most, ++now);
      await new Promise((r) => setTimeout(r, 5));
      now--;
      return reply(RELEVANCE_BATCH_SIZE);
    });
    const { results, failedBatches } = await scoreRelevance(items(RELEVANCE_BATCH_SIZE * 10));
    expect(llm.call).toHaveBeenCalledTimes(10);
    expect(most).toBe(MAX_CONCURRENT_CALLS);
    expect(failedBatches).toBe(0);
    expect(results.every((r) => r?.score === 70)).toBe(true);
  });

  it('after out-of-credit sends no further batch, and leaves every unsent item unscored', async () => {
    llm.call.mockReset().mockRejectedValue(new OutOfCreditError('402', { operation: 'news.relevance', attempts: 1, elapsedMs: 0, status: 402 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { results, failedBatches, outOfCredit } = await scoreRelevance(items(RELEVANCE_BATCH_SIZE * 10));
    // The first few batches were already in flight; none started after the 402.
    expect(llm.call.mock.calls.length).toBeLessThanOrEqual(MAX_CONCURRENT_CALLS);
    expect(outOfCredit).toBe(true);
    expect(failedBatches).toBe(10);
    expect(results).toHaveLength(RELEVANCE_BATCH_SIZE * 10);
    expect(results.every((r) => r === null)).toBe(true);
  });
});

describe('parseRelevance', () => {
  it('maps each index to a clamped score, a known category and a summary', () => {
    const reply = JSON.stringify({
      items: [
        { i: 0, relevance: 92.4, category: 'oireachtas', summary: 'The Dáil passed the bill.' },
        { i: 1, relevance: 140, category: 'housing', summary: 'x' },
        { i: 2, relevance: -3, category: 'sport', summary: '' },
      ],
    });
    expect(parseRelevance(reply, 3)).toEqual([
      { score: 92, category: 'oireachtas', summary: 'The Dáil passed the bill.' },
      { score: 100, category: 'housing', summary: 'x' },
      { score: 0, category: 'other', summary: null },
    ]);
  });

  it('caps a long summary at the word limit', () => {
    const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
    const [r] = parseRelevance(JSON.stringify({ items: [{ i: 0, relevance: 70, category: 'eu', summary: long }] }), 1);
    expect(r!.summary!.split(' ')).toHaveLength(SUMMARY_MAX_WORDS);
    expect(r!.summary!.endsWith('…')).toBe(true);
  });

  it('leaves skipped, out-of-range and score-less entries unscored (null), never guessed', () => {
    const reply = JSON.stringify({ items: [{ i: 7, relevance: 90 }, { i: '1', relevance: 90 }, { i: 1, category: 'health' }, null] });
    expect(parseRelevance(reply, 2)).toEqual([null, null]);
  });

  it('survives prose and code fences', () => {
    expect(parseRelevance('Sorry, I cannot help', 1)).toEqual([null]);
    expect(parseRelevance('```json\n{"items":[{"i":0,"relevance":65,"category":"health","summary":"s"}]}\n```', 1)).toEqual([
      { score: 65, category: 'health', summary: 's' },
    ]);
  });
});

describe('buildPrompt', () => {
  it('indexes items from 0 with source, quoted title and a trimmed standfirst', () => {
    expect(
      buildPrompt([
        { title: 'Budget cut', summary: 'Childcare', source: 'RTÉ News' },
        { title: 'Storm', summary: null, source: 'The Journal' },
      ]),
    ).toBe('[0] (RTÉ News) "Budget cut" — Childcare\n[1] (The Journal) "Storm"');
  });
});

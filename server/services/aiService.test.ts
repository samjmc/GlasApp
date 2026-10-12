import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The SDK client, so completeJson runs end to end without a network.
const create = vi.hoisted(() => vi.fn());
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

const {
  AIError,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_OPENAI_MODEL,
  MAX_CONCURRENT_CALLS,
  OutOfCreditError,
  RATE_LIMIT_WAITS_MS,
  applyProvider,
  chatProviderFrom,
  completeJson,
  executeWithRetry,
  isTransientAIError,
} = await import('./aiService');

describe('chatProviderFrom', () => {
  it('uses DeepSeek when LLM_API_KEY is set, with thinking switched off', () => {
    expect(chatProviderFrom({ LLM_API_KEY: 'k', LLM_BASE_URL: 'https://api.deepseek.com/v1', LLM_MODEL_NAME: 'deepseek-flash', OPENAI_API_KEY: 'o' })).toEqual({
      name: 'deepseek',
      apiKey: 'k',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-flash',
      extraBody: { thinking: { type: 'disabled' } },
    });
  });

  it('defaults the DeepSeek base URL and model', () => {
    expect(chatProviderFrom({ LLM_API_KEY: 'k' })).toMatchObject({ baseURL: DEFAULT_DEEPSEEK_BASE_URL, model: DEFAULT_DEEPSEEK_MODEL, name: 'deepseek' });
  });

  it('another OpenAI-compatible endpoint gets no DeepSeek-only fields', () => {
    expect(chatProviderFrom({ LLM_API_KEY: 'k', LLM_BASE_URL: 'https://llm.example.com/v1' })).toMatchObject({
      name: 'openai-compatible',
      model: null,
      extraBody: {},
    });
  });

  it('falls back to OpenAI, then to nothing', () => {
    expect(chatProviderFrom({ OPENAI_API_KEY: 'o' })).toEqual({ name: 'openai', apiKey: 'o', model: null, extraBody: {} });
    expect(chatProviderFrom({ OPENAI_API_KEY: 'o', LLM_MODEL_NAME: 'gpt-4.1-mini' })).toMatchObject({ model: 'gpt-4.1-mini' });
    expect(chatProviderFrom({})).toBeNull();
  });
});

describe('applyProvider', () => {
  const base = { model: 'gpt-4o', messages: [{ role: 'user' as const, content: 'hi' }], response_format: { type: 'json_object' as const } };
  const { model: _named, ...unnamed } = base;

  it('DeepSeek replaces whatever model the caller named and adds its fields', () => {
    const provider = chatProviderFrom({ LLM_API_KEY: 'k' })!;
    expect(applyProvider(base, provider)).toEqual({ ...base, model: 'deepseek-flash', thinking: { type: 'disabled' } });
  });

  it('OpenAI sends the request unchanged', () => {
    expect(applyProvider(base, chatProviderFrom({ OPENAI_API_KEY: 'o' })!)).toEqual(base);
  });

  it('a caller that names no model gets the provider default, never a model of another provider', () => {
    expect(applyProvider(unnamed, chatProviderFrom({ OPENAI_API_KEY: 'o' })!).model).toBe(DEFAULT_OPENAI_MODEL);
    expect(applyProvider(unnamed, chatProviderFrom({ LLM_API_KEY: 'k' })!).model).toBe(DEFAULT_DEEPSEEK_MODEL);
  });
});

const httpError = (status: number, extra: Record<string, unknown> = {}) => Object.assign(new Error(`${status} from the provider`), { status, ...extra });

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('402 is OutOfCreditError at once: one attempt, no retry', async () => {
    const run = vi.fn(async () => {
      throw httpError(402);
    });
    const error = await executeWithRetry('t', undefined, run).catch((e) => e);
    expect(error).toBeInstanceOf(OutOfCreditError);
    expect(error).toBeInstanceOf(AIError);
    expect(run).toHaveBeenCalledTimes(1);
    expect(isTransientAIError(error)).toBe(false);
  });

  it("OpenAI's insufficient_quota 429 is out of credit too, not a rate limit to wait out", async () => {
    const run = vi.fn(async () => {
      throw httpError(429, { code: 'insufficient_quota' });
    });
    await expect(executeWithRetry('t', undefined, run)).rejects.toBeInstanceOf(OutOfCreditError);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a 429 waits 5 s, then 15 s, without using up the ordinary retries', async () => {
    let calls = 0;
    const run = vi.fn(async () => {
      calls++;
      if (calls <= 2) throw httpError(429);
      if (calls <= 4) throw httpError(500);
      return 'ok';
    });
    const result = executeWithRetry('t', { retries: 2 }, run);
    await vi.advanceTimersByTimeAsync(RATE_LIMIT_WAITS_MS[0] - 1);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(RATE_LIMIT_WAITS_MS[1]);
    expect(run).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(result).resolves.toBe('ok');
    expect(run).toHaveBeenCalledTimes(5);
  });

  it('gives up after the 429 waits run out', async () => {
    const run = vi.fn(async () => {
      throw httpError(429);
    });
    const result = executeWithRetry('t', { retries: 0 }, run).catch((e) => e);
    await vi.advanceTimersByTimeAsync(RATE_LIMIT_WAITS_MS.reduce((a, b) => a + b, 0));
    const error = await result;
    expect(error).toBeInstanceOf(AIError);
    expect(run).toHaveBeenCalledTimes(RATE_LIMIT_WAITS_MS.length + 1);
    expect(isTransientAIError(error)).toBe(true);
  });

  it('a 400 is not retried and is not transient: the same request fails the same way', async () => {
    const run = vi.fn(async () => {
      throw httpError(400);
    });
    const error = await executeWithRetry('t', undefined, run).catch((e) => e);
    expect(run).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(AIError);
    expect(isTransientAIError(error)).toBe(false);
  });

  it(`never has more than ${MAX_CONCURRENT_CALLS} attempts in flight, and every call still finishes`, async () => {
    vi.useRealTimers();
    let now = 0;
    let most = 0;
    const releases: Array<() => void> = [];
    const run = async () => {
      most = Math.max(most, ++now);
      await new Promise<void>((resolve) => releases.push(resolve));
      now--;
      return 'ok';
    };
    const all = Promise.all(Array.from({ length: 10 }, () => executeWithRetry('t', undefined, run)));
    for (let released = 0; released < 10; released++) {
      await vi.waitFor(() => expect(releases.length).toBeGreaterThan(released));
      releases[released]!();
    }
    await expect(all).resolves.toHaveLength(10);
    expect(most).toBe(MAX_CONCURRENT_CALLS);
  });
});

describe('completeJson', () => {
  const env = { ...process.env };
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockReset();
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it('throws, never returns null, when no model is configured: "no model" is not "nothing found"', async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(completeJson('s', 'u', 0, 'op')).rejects.toBeInstanceOf(AIError);
  });

  it('parses the JSON reply, fenced or not; null for a reply that is not JSON', async () => {
    process.env.LLM_API_KEY = 'k';
    create.mockResolvedValueOnce({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] });
    expect(await completeJson('s', 'u', 0, 'op')).toEqual({ a: 1 });
    expect(create.mock.calls[0]![0]).toMatchObject({ model: DEFAULT_DEEPSEEK_MODEL, temperature: 0 });
    create.mockResolvedValueOnce({ choices: [{ message: { content: 'sorry, no' } }] });
    expect(await completeJson('s', 'u', 0, 'op')).toBeNull();
  });

  it('an unreachable model throws, so the caller can retry later', async () => {
    process.env.LLM_API_KEY = 'k';
    create.mockRejectedValue(httpError(402));
    await expect(completeJson('s', 'u', 0, 'op')).rejects.toBeInstanceOf(OutOfCreditError);
  });
});

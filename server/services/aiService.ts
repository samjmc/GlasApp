/**
 * aiService.ts — centralized wrapper for all outbound model calls.
 *
 * Single ownership point for the chat-completions client, the model choice, retry/timeout
 * behaviour, the cap on calls in flight and structured call logging. No other file in server/
 * should construct an AI SDK client or call the SDK directly; they go through the wrappers here.
 *
 * Failure policy, the same for every caller:
 *   - 429 (rate limited): wait 5 s, 15 s, 45 s and try again, on top of the normal retries;
 *   - 402, or OpenAI's `insufficient_quota`: OutOfCreditError at once, never retried. Every later
 *     call would fail the same way, so a pipeline stops its run on it;
 *   - anything else that cannot reach the model: AIError after the retries.
 */
import OpenAI from "openai";

/** Number of retries after the first attempt (default => 3 total attempts). */
const DEFAULT_MAX_RETRIES = 2;
/** Per-attempt timeout in ms (30s). */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Base exponential-backoff delay in ms. */
const RETRY_BASE_DELAY_MS = 500;
/** Cap for a single backoff delay in ms. */
const RETRY_MAX_DELAY_MS = 30_000;
/**
 * Waits after a 429 before trying again. DeepSeek caps concurrent requests per account by its
 * balance (10 on 2026-10-04), and other apps share the key: a pilot run lost 22 of 50 debates
 * to 429s when the sub-second backoff gave up.
 */
export const RATE_LIMIT_WAITS_MS = [5_000, 15_000, 45_000];
/** Model calls in flight at once in this process, whoever makes them: under the provider's cap of 10. */
export const MAX_CONCURRENT_CALLS = 4;

export interface AIOptions {
  /** Number of retries after the first attempt (default 2 => 3 total attempts). */
  retries?: number;
  /** Per-attempt timeout in ms (default 30_000). */
  timeoutMs?: number;
  /** Operation name used in structured logs (defaults to the wrapper name). */
  operation?: string;
}

export class AIError extends Error {
  readonly operation: string;
  readonly attempts: number;
  readonly elapsedMs: number;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(message: string, opts: { operation: string; attempts: number; elapsedMs: number; status?: number; cause?: unknown }) {
    super(message);
    this.name = "AIError";
    this.operation = opts.operation;
    this.attempts = opts.attempts;
    this.elapsedMs = opts.elapsedMs;
    this.status = opts.status;
    this.cause = opts.cause;
  }
}

/** The provider says the account has no credit left. Stop the run: every later call fails the same way. */
export class OutOfCreditError extends AIError {
  constructor(message: string, opts: ConstructorParameters<typeof AIError>[1]) {
    super(message, opts);
    this.name = "OutOfCreditError";
  }
}

/**
 * The chat-completions provider. DeepSeek when LLM_API_KEY is set (the same variables the
 * GlasIntelligence apps use), otherwise OpenAI. DeepSeek speaks the OpenAI Chat Completions
 * protocol, so every chat caller works unchanged.
 */
export interface ChatProvider {
  name: "deepseek" | "openai" | "openai-compatible";
  apiKey: string;
  baseURL?: string;
  /** When set, every chat call uses this model whatever the caller asked for. */
  model: string | null;
  /** Provider-specific request fields merged into every chat call. */
  extraBody: Record<string, unknown>;
}

export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";
/** The model when neither LLM_MODEL_NAME nor the caller names one. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

type Env = Record<string, string | undefined>;

export function chatProviderFrom(env: Env): ChatProvider | null {
  if (env.LLM_API_KEY) {
    const baseURL = env.LLM_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
    const isDeepSeek = /deepseek/i.test(baseURL);
    return {
      name: isDeepSeek ? "deepseek" : "openai-compatible",
      apiKey: env.LLM_API_KEY,
      baseURL,
      model: env.LLM_MODEL_NAME || (isDeepSeek ? DEFAULT_DEEPSEEK_MODEL : null),
      // DeepSeek V4.x reasons by default; in that mode every follow-up turn must echo
      // `reasoning_content` back or the API returns 400 (tool loops here do not), and hidden
      // reasoning only adds latency to JSON extraction. Measured on deepseek-flash 2026-09-22.
      extraBody: isDeepSeek ? { thinking: { type: "disabled" } } : {},
    };
  }
  if (env.OPENAI_API_KEY) return { name: "openai", apiKey: env.OPENAI_API_KEY, model: env.LLM_MODEL_NAME || null, extraBody: {} };
  return null;
}

/** Whether a chat-completions provider (DeepSeek or OpenAI) is configured. */
export function isLLMConfigured(): boolean {
  return chatProviderFrom(process.env) !== null;
}

// Lazy shared client. maxRetries: 0 so the SDK's internal retry never stacks
// on top of our own retry loop (which would multiply attempts).
let chatClient: { client: OpenAI; provider: ChatProvider } | null = null;

function getChatClient(): { client: OpenAI; provider: ChatProvider } {
  if (!chatClient) {
    const provider = chatProviderFrom(process.env);
    if (!provider) {
      throw new Error("No LLM configured: set LLM_API_KEY (DeepSeek) or OPENAI_API_KEY. AI features are disabled.");
    }
    chatClient = { client: new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL, maxRetries: 0 }), provider };
  }
  return chatClient;
}

/** A chat request; `model` only where a caller must pin one (the provider's LLM_MODEL_NAME still wins). */
export type ChatParams = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "model"> & { model?: string };

/**
 * The request actually sent: the provider's model and extra fields applied. The model is, in
 * order: LLM_MODEL_NAME (or DeepSeek's default), the caller's, DEFAULT_OPENAI_MODEL. Pure.
 */
export function applyProvider(params: ChatParams, provider: ChatProvider): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  return { ...params, ...provider.extraBody, model: provider.model ?? params.model ?? DEFAULT_OPENAI_MODEL };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** At most MAX_CONCURRENT_CALLS attempts in flight; the rest wait in arrival order. */
let inFlight = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT_CALLS) await new Promise<void>((resolve) => waiting.push(resolve));
  else inFlight++;
  try {
    return await run();
  } finally {
    // Hand the slot straight to the next caller, or give it back.
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  }
}

function backoffDelayMs(attempt: number): number {
  const exponential = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  // Full jitter in [0, exponential) to avoid thundering-herd retries.
  return Math.floor(Math.random() * exponential);
}

const statusOf = (error: unknown) => (error as { status?: number })?.status;

function isOutOfCredit(error: unknown): boolean {
  const status = statusOf(error);
  return status === 402 || (status === 429 && (error as { code?: string })?.code === "insufficient_quota");
}

function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  if (typeof status === "number") {
    if (status === 408 || status === 409 || status === 429 || status === 529 || status >= 500) {
      return true;
    }
    return false;
  }
  // No status on the error => almost always a network/connection failure or a timeout.
  return true;
}

/** True for an AIError a later run may not see: the model was down, slow or busy, not given a bad request. */
export function isTransientAIError(error: unknown): boolean {
  return error instanceof AIError && !(error instanceof OutOfCreditError) && isRetryable({ status: error.status });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function toAIError(error: unknown, operation: string, attempts: number, elapsedMs: number): AIError {
  if (error instanceof AIError) return error;
  const opts = { operation, attempts, elapsedMs, status: statusOf(error), cause: error };
  return isOutOfCredit(error) ? new OutOfCreditError(errorMessage(error), opts) : new AIError(errorMessage(error), opts);
}

function logUsage(operation: string, result: unknown): void {
  const usage = (result as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } })?.usage;
  if (!usage) return;
  console.log(
    `[aiService] ${operation}: usage promptTokens=${usage.prompt_tokens ?? "n/a"} completionTokens=${usage.completion_tokens ?? "n/a"}`,
  );
}

/** The retry loop every call goes through. Exported for tests. */
export async function executeWithRetry<T>(
  operation: string,
  options: AIOptions | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const maxRetries = options?.retries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  let rateLimited = 0;

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await withSlot(() => run(AbortSignal.timeout(timeoutMs)));
      console.log(`[aiService] ${operation}: success attempts=${attempt + 1} elapsedMs=${Date.now() - startedAt}`);
      logUsage(operation, result);
      return result;
    } catch (error) {
      const failed = () => {
        const elapsedMs = Date.now() - startedAt;
        console.error(`[aiService] ${operation}: FAILED after ${attempt + 1} attempt(s) elapsedMs=${elapsedMs} error=${errorMessage(error)}`);
        return toAIError(error, operation, attempt + 1, elapsedMs);
      };
      if (isOutOfCredit(error)) throw failed();
      // A 429 has its own longer waits and does not use up the ordinary retries.
      const ordinary = attempt - rateLimited;
      const delay =
        statusOf(error) === 429
          ? rateLimited < RATE_LIMIT_WAITS_MS.length
            ? RATE_LIMIT_WAITS_MS[rateLimited++]
            : null
          : ordinary < maxRetries && isRetryable(error)
            ? backoffDelayMs(ordinary)
            : null;
      if (delay === null) throw failed();
      console.warn(`[aiService] ${operation}: attempt ${attempt + 1} failed (${errorMessage(error)}) retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
}

/** Chat Completions with retry/timeout/logging, on the configured provider and model (see applyProvider). */
export async function callChatCompletion(params: ChatParams, options?: AIOptions): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const operation = options?.operation ?? "callChatCompletion";
  const { client, provider } = getChatClient();
  const request = applyProvider(params, provider);
  return executeWithRetry(operation, options, (signal) => client.chat.completions.create(request, { signal }));
}

/**
 * Ask the model for a JSON object. Null when the model answered with nothing usable. Throws an
 * AIError (an OutOfCreditError when the account is empty) when no model is configured or none
 * could be reached, so a caller never mistakes an outage for "the model found nothing".
 */
export async function completeJson(system: string, user: string, temperature: number, operation: string): Promise<unknown> {
  if (!isLLMConfigured()) throw new AIError("No LLM configured (LLM_API_KEY or OPENAI_API_KEY)", { operation, attempts: 0, elapsedMs: 0 });
  const response = await callChatCompletion(
    {
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { operation },
  );
  const content = response.choices[0]?.message.content;
  if (!content) return null;
  try {
    return JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
}

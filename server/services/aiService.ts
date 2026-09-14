/**
 * aiService.ts — centralized wrapper for all outbound AI calls.
 *
 * Single ownership point for the OpenAI + Anthropic SDK clients, retry/timeout
 * behaviour, fallback handling and structured call logging. No other file in
 * server/ should construct an AI SDK client or call the SDK directly; they
 * should go through the typed wrappers exported here.
 */
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

/** Number of retries after the first attempt (default => 3 total attempts). */
const DEFAULT_MAX_RETRIES = 2;
/** Per-attempt timeout in ms (30s). */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Base exponential-backoff delay in ms. */
const RETRY_BASE_DELAY_MS = 500;
/** Cap for a single backoff delay in ms. */
const RETRY_MAX_DELAY_MS = 30_000;

export interface AIOptions {
  /** Number of retries after the first attempt (default 2 => 3 total attempts). */
  retries?: number;
  /** Per-attempt timeout in ms (default 30_000). */
  timeoutMs?: number;
  /** On total failure, return the last successful result for this call signature if available. */
  fallbackToCache?: boolean;
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

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Lazy shared clients. maxRetries: 0 so the SDK's internal retry never stacks
// on top of our own retry loop (which would multiply attempts).
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required but not set. AI analysis features are disabled.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  }
  return openaiClient;
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is required but not set. AI analysis features are disabled.");
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  }
  return anthropicClient;
}

// Minimal in-memory fallback cache (stopgap until Phase 3C ships the cache
// adapter). Only populated when `fallbackToCache` is requested by the caller.
const fallbackCache = new Map<string, unknown>();
const FALLBACK_CACHE_MAX_KEYS = 500;

function cacheKeyFor(operation: string, payload: unknown): string {
  const hash = fnv1a(JSON.stringify(payload ?? {}));
  return `${operation}:${hash}`;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attempt: number): number {
  const exponential = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  // Full jitter in [0, exponential) to avoid thundering-herd retries.
  return Math.floor(Math.random() * exponential);
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (typeof status === "number") {
    if (status === 408 || status === 409 || status === 429 || status === 529 || status >= 500) {
      return true;
    }
    return false;
  }
  const name = (error as { name?: string })?.name ?? "";
  if (name === "TimeoutError" || name === "AbortError" || name === "APIUserAbortError" || name === "APIConnectionError" || name === "APIConnectionTimeoutError") {
    return true;
  }
  // No status on the error => almost always a network/connection failure.
  return true;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function toAIError(error: unknown, operation: string, attempts: number, elapsedMs: number): AIError {
  if (error instanceof AIError) return error;
  const status = (error as { status?: number })?.status;
  return new AIError(errorMessage(error), { operation, attempts, elapsedMs, status, cause: error });
}

function logUsage(operation: string, result: unknown): void {
  const usage = (result as { usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number; total_tokens?: number } })?.usage;
  if (!usage) return;
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens;
  console.log(
    `[aiService] ${operation}: usage promptTokens=${promptTokens ?? "n/a"} completionTokens=${completionTokens ?? "n/a"}`,
  );
}

async function executeWithRetry<T>(
  operation: string,
  options: AIOptions | undefined,
  run: (signal: AbortSignal) => Promise<T>,
  cachePayload: unknown,
): Promise<T> {
  const maxRetries = options?.retries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fallbackToCache = options?.fallbackToCache ?? false;
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptStartedAt = Date.now();
    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const result = await run(signal);
      const elapsedMs = Date.now() - startedAt;
      console.log(
        `[aiService] ${operation}: success attempts=${attempt + 1} elapsedMs=${elapsedMs}`,
      );
      logUsage(operation, result);
      if (fallbackToCache) {
        const key = cacheKeyFor(operation, cachePayload);
        if (fallbackCache.size >= FALLBACK_CACHE_MAX_KEYS) {
          fallbackCache.clear();
        }
        fallbackCache.set(key, result);
      }
      return result;
    } catch (error) {
      const attemptElapsedMs = Date.now() - attemptStartedAt;
      if (attempt < maxRetries && isRetryable(error)) {
        const delay = backoffDelayMs(attempt);
        console.warn(
          `[aiService] ${operation}: attempt ${attempt + 1} failed (${errorMessage(error)}) retrying in ${delay}ms`,
        );
        await sleep(delay);
        continue;
      }
      const elapsedMs = Date.now() - startedAt;
      console.error(
        `[aiService] ${operation}: FAILED after ${attempt + 1} attempt(s) elapsedMs=${elapsedMs} error=${errorMessage(error)}`,
      );
      if (fallbackToCache) {
        const key = cacheKeyFor(operation, cachePayload);
        if (fallbackCache.has(key)) {
          const cached = fallbackCache.get(key) as T;
          console.warn(`[aiService] ${operation}: returning cached fallback result`);
          return cached;
        }
      }
      throw toAIError(error, operation, attempt + 1, elapsedMs);
    }
  }
  throw new AIError("unreachable", { operation, attempts: maxRetries + 1, elapsedMs: Date.now() - startedAt });
}

/**
 * Low-level string prompt -> string completion. Convenience wrapper over
 * callChatCompletion; most call sites should use the typed wrappers below.
 */
export async function callAI(
  prompt: string,
  options: AIOptions & {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    system?: string;
  } = {},
): Promise<string> {
  const completion = await callChatCompletion(
    {
      model: options.model ?? "gpt-4o",
      messages: [
        ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
        { role: "user" as const, content: prompt },
      ],
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
    },
    options,
  );
  return completion.choices[0]?.message?.content ?? "";
}

/** OpenAI Chat Completions with retry/timeout/logging. */
export async function callChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  options?: AIOptions,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const operation = options?.operation ?? "callChatCompletion";
  const client = getOpenAIClient();
  return executeWithRetry(
    operation,
    options,
    (signal) => client.chat.completions.create(params, { signal }),
    params,
  );
}

/** OpenAI Responses API with retry/timeout/logging. */
export async function callResponses(
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
  options?: AIOptions,
): Promise<OpenAI.Responses.Response> {
  const operation = options?.operation ?? "callResponses";
  const client = getOpenAIClient();
  return executeWithRetry(
    operation,
    options,
    (signal) => client.responses.create(params, { signal }),
    params,
  );
}

/** OpenAI text embeddings with retry/timeout/logging. */
export async function callEmbedding(
  text: string,
  options?: AIOptions & { model?: string },
): Promise<number[]> {
  const operation = options?.operation ?? "callEmbedding";
  const client = getOpenAIClient();
  const response = await executeWithRetry(
    operation,
    options,
    (signal) =>
      client.embeddings.create(
        {
          model: options?.model ?? "text-embedding-3-small",
          input: text.replace(/\n/g, " "),
          encoding_format: "float",
        },
        { signal },
      ),
    { model: options?.model ?? "text-embedding-3-small", input: text },
  );
  return response.data[0]?.embedding ?? [];
}

/** OpenAI image generation (DALL-E) with retry/timeout/logging. */
export async function callImageGeneration(
  params: OpenAI.Images.ImageGenerateParams,
  options?: AIOptions,
): Promise<OpenAI.Images.ImagesResponse> {
  const operation = options?.operation ?? "callImageGeneration";
  const client = getOpenAIClient();
  return executeWithRetry(
    operation,
    options,
    (signal) => client.images.generate(params, { signal }),
    params,
  );
}

/** Anthropic Messages API with retry/timeout/logging. */
export async function callAnthropicMessage(
  params: Anthropic.MessageCreateParamsNonStreaming,
  options?: AIOptions,
): Promise<Anthropic.Message> {
  const operation = options?.operation ?? "callAnthropicMessage";
  const client = getAnthropicClient();
  return executeWithRetry(
    operation,
    options,
    (signal) => client.messages.create(params, { signal }),
    params,
  );
}
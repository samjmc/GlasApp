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
  if (env.OPENAI_API_KEY) return { name: "openai", apiKey: env.OPENAI_API_KEY, model: null, extraBody: {} };
  return null;
}

/** Whether a chat-completions provider (DeepSeek or OpenAI) is configured. */
export function isLLMConfigured(): boolean {
  return chatProviderFrom(process.env) !== null;
}

/** Whether embeddings are available. DeepSeek has no embeddings API; they need OPENAI_API_KEY. */
export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Whether Anthropic API credentials are configured. */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Lazy shared clients. maxRetries: 0 so the SDK's internal retry never stacks
// on top of our own retry loop (which would multiply attempts).
let chatClient: { client: OpenAI; provider: ChatProvider } | null = null;
let embeddingClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

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

function getEmbeddingClient(): OpenAI {
  if (!embeddingClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Embeddings need OPENAI_API_KEY: DeepSeek has no embeddings API, and the stored vectors are OpenAI's.");
    }
    embeddingClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  }
  return embeddingClient;
}

/** The request actually sent: the provider's model and extra fields applied. Pure. */
export function applyProvider(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  provider: ChatProvider,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  return { ...params, ...provider.extraBody, model: provider.model ?? params.model };
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
): Promise<T> {
  const maxRetries = options?.retries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
      throw toAIError(error, operation, attempt + 1, elapsedMs);
    }
  }
  throw new AIError("unreachable", { operation, attempts: maxRetries + 1, elapsedMs: Date.now() - startedAt });
}

/**
 * Chat Completions with retry/timeout/logging, on the configured provider. Callers name an
 * OpenAI model; with DeepSeek configured every call runs on LLM_MODEL_NAME instead.
 */
export async function callChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  options?: AIOptions,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const operation = options?.operation ?? "callChatCompletion";
  const { client, provider } = getChatClient();
  const request = applyProvider(params, provider);
  return executeWithRetry(
    operation,
    options,
    (signal) => client.chat.completions.create(request, { signal }),
  );
}

/** OpenAI text embeddings with retry/timeout/logging. Always OpenAI (see isEmbeddingConfigured). */
export async function callEmbedding(
  text: string,
  options?: AIOptions & { model?: string },
): Promise<number[]> {
  const operation = options?.operation ?? "callEmbedding";
  const client = getEmbeddingClient();
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
  );
  return response.data[0]?.embedding ?? [];
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
  );
}
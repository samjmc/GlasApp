/**
 * llm.mjs — shared LLM client helper for scripts/.
 *
 * Mirrors server/services/aiService.ts: DeepSeek when LLM_API_KEY is set (same
 * env vars the GlasIntelligence apps use), otherwise OpenAI. DeepSeek speaks the
 * OpenAI Chat Completions protocol, so every caller works unchanged.
 *
 * Every script under scripts/ that talks to a chat-completions model should
 * import `chat`/`chatModel`/`chatClient` from here instead of constructing its
 * own `new OpenAI(...)`, so it runs on DeepSeek like the server does.
 *
 * Embeddings have no DeepSeek equivalent — `embeddingClient()` always uses
 * OpenAI and throws a clear error if OPENAI_API_KEY is unset.
 */
import OpenAI from 'openai';

let _chatClient = null;

/** Lazily-created chat-completions client: DeepSeek if LLM_API_KEY is set, else OpenAI. */
export function chatClient() {
  if (_chatClient) return _chatClient;

  if (process.env.LLM_API_KEY) {
    _chatClient = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
      maxRetries: 2,
    });
  } else if (process.env.OPENAI_API_KEY) {
    _chatClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 2,
    });
  } else {
    throw new Error('No LLM configured: set LLM_API_KEY (DeepSeek) or OPENAI_API_KEY');
  }

  return _chatClient;
}

/** The model to request: DeepSeek's model when LLM_API_KEY is set, else whatever the caller asked for. */
export function chatModel(requested) {
  if (process.env.LLM_API_KEY) {
    return process.env.LLM_MODEL_NAME || 'deepseek-flash';
  }
  return requested;
}

function isDeepSeek() {
  if (!process.env.LLM_API_KEY) return false;
  const baseURL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
  return baseURL.includes('deepseek');
}

/**
 * Chat-completions call, routed to DeepSeek or OpenAI per the env vars above.
 * DeepSeek's V4.x thinking mode breaks multi-turn calls with HTTP 400, so it is
 * explicitly disabled whenever DeepSeek is the active provider.
 */
export function chat(params) {
  return chatClient().chat.completions.create({
    ...params,
    model: chatModel(params.model),
    ...(isDeepSeek() ? { thinking: { type: 'disabled' } } : {}),
  });
}

/** Embeddings have no DeepSeek equivalent: always OpenAI, and always explicit about that. */
export function embeddingClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Embeddings need OPENAI_API_KEY: DeepSeek has no embeddings API');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

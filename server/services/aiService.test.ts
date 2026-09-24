import { describe, expect, it } from 'vitest';
import { DEFAULT_DEEPSEEK_BASE_URL, DEFAULT_DEEPSEEK_MODEL, applyProvider, chatProviderFrom } from './aiService';

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
    expect(chatProviderFrom({})).toBeNull();
  });
});

describe('applyProvider', () => {
  const base = { model: 'gpt-4o', messages: [{ role: 'user' as const, content: 'hi' }], response_format: { type: 'json_object' as const } };

  it('DeepSeek replaces whatever model the caller named and adds its fields', () => {
    const provider = chatProviderFrom({ LLM_API_KEY: 'k' })!;
    expect(applyProvider(base, provider)).toEqual({ ...base, model: 'deepseek-flash', thinking: { type: 'disabled' } });
  });

  it('OpenAI sends the request unchanged', () => {
    expect(applyProvider(base, chatProviderFrom({ OPENAI_API_KEY: 'o' })!)).toEqual(base);
  });
});

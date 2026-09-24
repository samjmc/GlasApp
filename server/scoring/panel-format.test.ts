/**
 * Every agent is a separate LLM call. If its prompt does not name the output keys, a model
 * other than GPT-4o invents its own and every score parses as null (DeepSeek, 2026-09-24).
 * Pin the keys runAgent reads to the format appended to every agent prompt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({}));
vi.mock('../services/aiService', () => ({ callChatCompletion: vi.fn() }));
const { AGENT_OUTPUT_FORMAT } = await import('./panel');

describe('agent output format', () => {
  it('names every key runAgent parses', () => {
    for (const key of ['transparency_score', 'effectiveness_score', 'integrity_score', 'consistency_score', 'overall_impact', 'reasoning', 'confidence', 'bias_declaration']) {
      expect(AGENT_OUTPUT_FORMAT).toContain(`"${key}"`);
    }
  });

  it('is appended to the prompt of every agent runAgent calls', () => {
    const src = fs.readFileSync(path.join(__dirname, 'panel.ts'), 'utf8');
    expect(src).toMatch(/const systemPrompt = `\$\{rolePrompt\}\\n\\n\$\{AGENT_OUTPUT_FORMAT\}`;/);
  });
});

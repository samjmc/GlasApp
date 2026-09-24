/**
 * "Is this Irish politics?" One LLM call per batch of titles, typed result.
 */
import { callChatCompletion, isOpenAIConfigured } from '../services/aiService';

export const CLASSIFY_BATCH_SIZE = 20;
export const MIN_CONFIDENCE = 0.55;
const MODEL = 'gpt-4.1-mini';

export interface ClassifyInput {
  title: string;
  summary: string | null;
  source: string;
}

export interface Verdict {
  political: boolean;
  confidence: number;
}

const SYSTEM = `You classify Irish news items for a site that tracks Irish politicians and public policy.
An item is political when it concerns Irish TDs, senators, ministers, parties, the Oireachtas, government
departments, budgets, referenda, elections, public services, or Irish government positions abroad
(EU, UN, foreign aid). Crime, sport, weather, celebrity and business stories are NOT political unless a
politician, a policy decision or public spending is central to them.

Reply with JSON only: {"items":[{"i":<index>,"political":true|false,"confidence":0..1}, ...]},
one entry per input item, same indices.`;

export function buildPrompt(items: ClassifyInput[]): string {
  return items
    .map((it, i) => `${i}. [${it.source}] ${it.title}${it.summary ? ` — ${it.summary.slice(0, 280)}` : ''}`)
    .join('\n');
}

/**
 * Parse the model's reply. An index the model skipped or mangled is NOT political: dropping
 * one story is cheaper than letting junk into the feed and the scoring spend.
 */
export function parseVerdicts(reply: string, count: number): Verdict[] {
  const out: Verdict[] = Array.from({ length: count }, () => ({ political: false, confidence: 0 }));
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    return out;
  }
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return out;
  for (const raw of items) {
    const { i, political, confidence } = (raw ?? {}) as Record<string, unknown>;
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= count) continue;
    const c = typeof confidence === 'number' ? Math.min(Math.max(confidence, 0), 1) : 0;
    out[i] = { political: political === true && c >= MIN_CONFIDENCE, confidence: c };
  }
  return out;
}

export async function classify(items: ClassifyInput[]): Promise<Verdict[]> {
  if (items.length === 0) return [];
  if (!isOpenAIConfigured()) throw new Error('OPENAI_API_KEY is not set: news cannot be classified');

  const verdicts: Verdict[] = [];
  for (let start = 0; start < items.length; start += CLASSIFY_BATCH_SIZE) {
    const batch = items.slice(start, start + CLASSIFY_BATCH_SIZE);
    const completion = await callChatCompletion(
      {
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildPrompt(batch) },
        ],
      },
      { operation: 'news.classify' },
    );
    verdicts.push(...parseVerdicts(completion.choices[0]?.message?.content ?? '', batch.length));
  }
  return verdicts;
}

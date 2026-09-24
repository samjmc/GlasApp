/**
 * How much does this item matter to someone following Irish politics? One LLM call per batch
 * of 20 items returns a 0–100 score, a category from a fixed list, and a neutral summary.
 *
 * The rubric, the floor and "store below-floor items but never show them" follow the RWA
 * portal's sector-news pass (lib/news/score-news-articles.ts), rewritten for politics. Items
 * below the floor are still stored, so the next run recognises their URL and does not pay to
 * score them again.
 */
import { isNewsCategory, type NewsCategory } from '@shared/news';
import { callChatCompletion, isLLMConfigured } from '../services/aiService';

export const RELEVANCE_BATCH_SIZE = 20;
/**
 * One point into the rubric's "clear political angle" band (60–79). Everything below is
 * general news with at most a passing policy mention: crime, courts, sport, weather.
 */
export const RELEVANCE_FLOOR = 60;
export const SUMMARY_MAX_WORDS = 45;
const MODEL = 'deepseek-flash';

export interface RelevanceInput {
  title: string;
  summary: string | null;
  source: string;
}

export interface Relevance {
  score: number;
  category: NewsCategory;
  /** Neutral, attributed, at most SUMMARY_MAX_WORDS words. NULL when the model gave none. */
  summary: string | null;
}

const SYSTEM = `You rank Irish news for Glas, a non-partisan site where voters follow their TDs, the parties,
the Government and the Oireachtas. Score how useful each item is to that reader.

SCORING (0-100)
90-100  Directly about named Irish politicians, a Government decision, a Dáil/Seanad vote or bill,
        an election or referendum.
80-89   A live Irish policy fight: budget, housing, health, immigration, climate, justice reform,
        with political actors involved.
60-79   Irish public-policy news with a clear political angle, or Irish government positions abroad
        (EU, UN, Northern Ireland, foreign aid).
30-59   Irish news with only a passing policy mention: most crime, court and business stories.
0-29    Not political: sport, celebrity, weather, lifestyle, or foreign news with no Irish angle.
Use the whole range. Do not give every item the same score.

CATEGORY: exactly one of government, oireachtas, elections, economy, housing, health, justice,
immigration, environment, education, foreign_affairs, northern_ireland, eu, local, other.

SUMMARY: at most ${SUMMARY_MAX_WORDS} words, two sentences: what happened, then why it matters politically.
Neutral wording only: attribute every claim ("X said"), no adjectives of praise or blame, no speculation,
nothing that is not in the item.

Reply with JSON only:
{"items":[{"i":<index>,"relevance":<0-100>,"category":"<category>","summary":"<summary>"}, ...]}
one entry per input item, same indices.`;

export function buildPrompt(items: RelevanceInput[]): string {
  return items
    .map((it, i) => `[${i}] (${it.source}) "${it.title}"${it.summary ? ` — ${it.summary.slice(0, 280)}` : ''}`)
    .join('\n');
}

function capWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  return words.length <= max ? words.join(' ') : `${words.slice(0, max).join(' ')}…`;
}

/**
 * Parse the reply. An item the model skipped or mangled gets `null`, meaning "not scored":
 * the caller keeps it visible (fail open), because an outage should not empty the feed.
 */
export function parseRelevance(reply: string, count: number): Array<Relevance | null> {
  const out: Array<Relevance | null> = Array.from({ length: count }, () => null);
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return out;
  }
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return out;
  for (const raw of items) {
    const { i, relevance, category, summary } = (raw ?? {}) as Record<string, unknown>;
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= count) continue;
    if (typeof relevance !== 'number' || !Number.isFinite(relevance)) continue;
    out[i] = {
      score: Math.round(Math.min(Math.max(relevance, 0), 100)),
      category: isNewsCategory(category) ? category : 'other',
      summary: typeof summary === 'string' && summary.trim() ? capWords(summary, SUMMARY_MAX_WORDS) : null,
    };
  }
  return out;
}

/** Score every item. A failed batch yields nulls for its items; other batches still count. */
export async function scoreRelevance(items: RelevanceInput[]): Promise<{ results: Array<Relevance | null>; failedBatches: number }> {
  if (items.length === 0) return { results: [], failedBatches: 0 };
  if (!isLLMConfigured()) throw new Error('No LLM configured (LLM_API_KEY or OPENAI_API_KEY): news cannot be ranked');

  const batches: RelevanceInput[][] = [];
  for (let i = 0; i < items.length; i += RELEVANCE_BATCH_SIZE) batches.push(items.slice(i, i + RELEVANCE_BATCH_SIZE));

  let failedBatches = 0;
  const scored = await Promise.all(
    batches.map(async (batch) => {
      try {
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
          { operation: 'news.relevance', timeoutMs: 60_000 },
        );
        return parseRelevance(completion.choices[0]?.message?.content ?? '', batch.length);
      } catch (error) {
        failedBatches++;
        console.error('news.relevance batch failed:', error instanceof Error ? error.message : error);
        return batch.map(() => null);
      }
    }),
  );
  return { results: scored.flat(), failedBatches };
}

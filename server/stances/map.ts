/**
 * Step 3 of TD stances: match each verified quote to one answer of the article's own
 * daily-vote question, or to none. The model call is injected.
 */
import { z } from 'zod';
import type { CompleteJson } from '../voting/service';

export interface MapQuestion {
  question: string;
  options: Array<{ key: string; label: string }>;
}

const MAP_TEMPERATURE = 0;

export const MAP_SYSTEM =
  'You match what a politician said to the answer of a question that it states, if any. You never infer or guess. Respond ONLY with valid JSON.';

export function mapPrompt(question: MapQuestion, quotes: string[]): string {
  return `
Question: ${question.question}

Answers:
${question.options.map((option) => `- ${option.key}: ${option.label}`).join('\n')}

Quotes:
${quotes.map((quote, index) => `${index}. ${JSON.stringify(quote)}`).join('\n')}

For each quote, choose the answer key ONLY when the quote itself states that choice. When it
does not clearly state one answer, use null. Do not infer from the speaker's party or office.

Return strict JSON with one entry per quote:
{ "matches": [ { "index": 0, "option_key": "${question.options[0]?.key ?? 'option_a'}" }, { "index": 1, "option_key": null } ] }
`.trim();
}

const replySchema = z.object({ matches: z.array(z.unknown()) });
const matchSchema = z.object({ index: z.number().int(), option_key: z.string().nullable() });

/**
 * One option key (or null) per quote, in quote order. Null when the reply is not
 * `{ matches: [...] }`. A key that is not one of the question's options counts as null; the
 * first entry for an index wins.
 */
export function parseMapping(raw: unknown, optionKeys: readonly string[], quoteCount: number): Array<string | null> | null {
  const reply = replySchema.safeParse(raw);
  if (!reply.success) return null;
  const keys = Array.from({ length: quoteCount }, (): string | null => null);
  const seen = new Set<number>();
  for (const entry of reply.data.matches) {
    const parsed = matchSchema.safeParse(entry);
    if (!parsed.success) continue;
    const { index, option_key: key } = parsed.data;
    if (index < 0 || index >= quoteCount || seen.has(index)) continue;
    seen.add(index);
    keys[index] = key !== null && optionKeys.includes(key) ? key : null;
  }
  return keys;
}

/** Null when the model is unavailable or its reply is unusable. */
export async function mapStances(
  question: MapQuestion,
  quotes: string[],
  complete: CompleteJson,
): Promise<Array<string | null> | null> {
  if (quotes.length === 0) return [];
  const raw = await complete(MAP_SYSTEM, mapPrompt(question, quotes), MAP_TEMPERATURE, 'stanceOptions');
  return parseMapping(
    raw,
    question.options.map((option) => option.key),
    quotes.length,
  );
}

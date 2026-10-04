/**
 * Step 1 of TD stances: ask the model which candidate TDs stated a position in an article,
 * with a quote copied from the text. The model call is injected; verify.ts checks the quote.
 */
import { z } from 'zod';
import { NEWS_QUOTE_KINDS, QUOTE_KINDS, type NewsQuoteKind, type QuoteKind } from '@shared/stancesApi';
import { POLICY_DOMAINS } from '../constants/policyTopics';
import type { CompleteJson } from '../voting/service';

export { NEWS_QUOTE_KINDS, QUOTE_KINDS, type NewsQuoteKind, type QuoteKind };

/** A TD the article mentions: id and offices from the tds table, not from the model. */
export interface CandidateTd {
  id: number;
  name: string;
  party: string | null;
  offices: string[];
}

export interface StanceArticle {
  title: string;
  content: string;
}

/** A stance as the model returned it, before verification. */
export interface RawStance {
  tdId: number;
  policyDomain: string;
  quote: string;
  quoteKind: NewsQuoteKind;
}

export const ARTICLE_CONTENT_LIMIT = 12_000;
export const QUOTE_MIN_WORDS = 8;
export const QUOTE_MAX_WORDS = 60;
const EXTRACT_TEMPERATURE = 0;

/** Exactly the text sent to the model. verify.ts must check quotes against this same string. */
export function extractionText(article: StanceArticle): string {
  return `${article.title}\n\n${article.content.slice(0, ARTICLE_CONTENT_LIMIT)}`;
}

export const EXTRACT_SYSTEM =
  'You record what named Irish TDs said in a news article, with exact quotes. You never rate, praise or criticise. Respond ONLY with valid JSON.';

export function extractPrompt(article: StanceArticle, candidates: CandidateTd[]): string {
  const tds = candidates
    .map((td) => {
      const offices = td.offices.length > 0 ? `; offices: ${td.offices.join(', ')}` : '';
      return `- td_id ${td.id}: ${td.name} (${td.party ?? 'Independent'}${offices})`;
    })
    .join('\n');
  return `
Find the policy positions that these TDs stated in the article below.

Candidate TDs (use ONLY these td_id values):
${tds}

Policy domains (use ONLY these keys): ${Object.keys(POLICY_DOMAINS).join(', ')}

A stance is one of:
- "direct": the TD's own words, shown in quotation marks in the article.
- "paraphrase": a reporter's sentence that attributes a position to the TD by name or office.

Do NOT record:
- a TD who is only mentioned;
- a party or government line that is not attributed to the TD;
- claims other people make about the TD;
- the TD describing or rebutting an opponent;
- questions put to the TD;
- procedural remarks, or anything with no policy content;
- a refusal or deferral to comment (for example "I can't comment on that yet");
- a statement that commits to nothing, only that a matter will be discussed or considered;
- a bare fact or figure (a price, a poll result, a cost) with no view on what should be done.

Rules:
- At most one stance per TD. An empty list is a normal answer.
- "quote" is ${QUOTE_MIN_WORDS} to ${QUOTE_MAX_WORDS} words copied EXACTLY from the article, one continuous passage, no ellipsis, no changes.
- Never rate, praise or criticise anyone.

Return strict JSON:
{ "stances": [ { "td_id": 123, "policy_domain": "housing", "quote": "exact words from the article", "quote_kind": "direct" } ] }

Article:
${extractionText(article)}
`.trim();
}

const replySchema = z.object({ stances: z.array(z.unknown()) });

const stanceSchema = z.object({
  td_id: z.number().int(),
  policy_domain: z.string(),
  quote: z.string(),
  // News kinds only: a 'division' here would fail td_stances' CHECK, and the article's whole save with it.
  quote_kind: z.enum(NEWS_QUOTE_KINDS),
});

/**
 * Parse the model's reply. Null when the reply is not `{ stances: [...] }`. Entries of the
 * wrong shape are dropped; ids, domains and quotes are checked by verify.ts, which counts them.
 */
export function parseExtraction(raw: unknown): RawStance[] | null {
  const reply = replySchema.safeParse(raw);
  if (!reply.success) return null;
  const stances: RawStance[] = [];
  for (const entry of reply.data.stances) {
    const parsed = stanceSchema.safeParse(entry);
    if (!parsed.success) continue;
    stances.push({
      tdId: parsed.data.td_id,
      policyDomain: parsed.data.policy_domain.trim().toLowerCase(),
      quote: parsed.data.quote,
      quoteKind: parsed.data.quote_kind,
    });
  }
  return stances;
}

/** Null when the model is unavailable or its reply is unusable; [] when it found no stances. */
export async function extractStances(
  article: StanceArticle,
  candidates: CandidateTd[],
  complete: CompleteJson,
): Promise<RawStance[] | null> {
  if (candidates.length === 0) return [];
  return parseExtraction(await complete(EXTRACT_SYSTEM, extractPrompt(article, candidates), EXTRACT_TEMPERATURE, 'tdStances'));
}

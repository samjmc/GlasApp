/**
 * Is a verified quote a policy position? The extraction model also returns refusals to comment,
 * "will be considered", bare figures and questions, whatever its prompt says. Jev (TypeSafe's
 * yes/no model, reached through Cloudflare Workers AI) answers one question per quote with P(yes).
 *
 * Measured on 23 real quotes (2026-10-04) at POSITION_THRESHOLD: 13 of 14 real positions kept,
 * 8 of 9 weak or borderline ones dropped, so 13 of the 14 kept were positions (93%).
 *
 * Fails closed: no key, an HTTP error or no answer gives null, and the stance is held back.
 */
import type { CandidateTd } from './extract';

export const POSITION_THRESHOLD = 0.5;

/** One question, not two smaller ones: on the same 23 quotes the single question did better. */
export const POSITION_QUESTION =
  'Does the passage show the named TD taking a policy position: saying what the government, the State or others should or should not do, or clearly supporting or opposing a specific policy?';

export interface PositionPassage {
  td: CandidateTd;
  headline: string;
  quote: string;
}

/** P(the passage is a policy position), or null when there is no answer. */
export type PositionCheck = (passage: PositionPassage) => Promise<number | null>;

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 15_000;

export function isJevConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.JEV_API_KEY && env.CLOUDFLARE_ACCOUNT_ID);
}

/** The text Jev judges. The headline is context; the question names the TD. */
export function positionState({ td, headline, quote }: PositionPassage): string {
  return `Named TD: ${td.name}${td.party ? ` (${td.party})` : ''}\nArticle headline: ${headline}\nPassage: ${quote}`;
}

/** Cloudflare wraps the answer twice: { result: { state, result: { answers } } }. */
function answerOf(payload: unknown): number | null {
  let node = payload as Record<string, unknown> | null;
  while (node && typeof node === 'object' && !('answers' in node)) node = node.result as Record<string, unknown> | null;
  const answer = (node?.answers as Record<string, Record<string, unknown>> | undefined)?.position;
  const p = Number(answer?.noul ?? answer?.probability);
  return answer && Number.isFinite(p) && p >= 0 && p <= 1 ? p : null;
}

export async function positionProbability(
  passage: PositionPassage,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  if (!isJevConfigured(env)) return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run`;
  const body = JSON.stringify({
    model: 'typesafe/jev',
    input: { state: positionState(passage), questions: { position: { type: 'noul', instructions: POSITION_QUESTION } } },
  });
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return answerOf(await res.json());
      // 402 is "out of credit": retrying will not help.
      if (res.status !== 429 && res.status < 500) {
        console.warn(`[stances] Jev position check: HTTP ${res.status}`);
        return null;
      }
    } catch (error) {
      console.warn('[stances] Jev position check failed:', error instanceof Error ? error.message : error);
    }
    if (attempt < MAX_ATTEMPTS - 1) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  return null;
}

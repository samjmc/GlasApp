/**
 * Client calls for the quiz and ideology endpoints (server/routes/quiz.ts, server/routes/ideology.ts).
 */
import { apiCall, apiEnvelope, orNullOn404 } from "@/lib/api";
import { IDEOLOGY_DIMENSIONS } from "@shared/ideology";
import type { IdeologyDimension, IdeologyVector } from "@shared/ideology";
import type { Matches, PartyAnswers, PartyIdeology, TdIdeology, UserIdeologyDetail } from "@shared/ideologyMatch";
import type { QuizResponse, QuizResult } from "@shared/quiz";

export type { Matches, PartyAnswers, PartyIdeology, PartyMatch, PartyQuizAnswer, TdMatch } from "@shared/ideologyMatch";

/** Per-dimension importance, 0..3 (1 = neutral). */
export type DimensionWeights = Record<IdeologyDimension, number>;

export interface IdeologyTimeline {
  points: { date: string; vector: IdeologyVector }[];
  party: PartyIdeology | null;
}

export function defaultWeights(): DimensionWeights {
  return Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, 1])) as DimensionWeights;
}

/** `economic:2,welfare:0.5` — only the dimensions that differ from the neutral weight. */
function weightsParam(weights?: Partial<DimensionWeights>): string {
  if (!weights) return "";
  return IDEOLOGY_DIMENSIONS.filter((d) => typeof weights[d] === "number" && weights[d] !== 1)
    .map((d) => `${d}:${weights[d]}`)
    .join(",");
}

/** `seed` = the one the quiz was planned from; the server stores the plan when the answers match it. */
export async function submitQuiz(answers: QuizResponse[], seed?: number): Promise<QuizResult> {
  return apiCall<QuizResult>("POST", "/api/quiz", { answers, seed });
}

/** Signed-in user's saved results, newest first. */
export async function fetchMyQuizResults(): Promise<QuizResult[]> {
  return apiCall<QuizResult[]>("GET", "/api/quiz/me");
}

/** Signed-in user's current position with its confidence per dimension; null until they take the quiz or vote. */
export async function fetchMyIdeology(): Promise<UserIdeologyDetail | null> {
  const data = await apiCall<UserIdeologyDetail | { vector: null; confidence: null }>("GET", "/api/ideology/me");
  return data.vector === null ? null : data;
}

export async function fetchMyTimeline(party?: string): Promise<IdeologyTimeline> {
  const qs = party ? `?party=${encodeURIComponent(party)}` : "";
  return apiCall<IdeologyTimeline>("GET", `/api/ideology/me/timeline${qs}`);
}

/**
 * `tdId` asks the server to fill that TD's shared-issue items as well as the top 5. `measured` =
 * the dimensions the user has evidence on; the matches use only those.
 */
export async function fetchMyMatches(
  weights?: Partial<DimensionWeights>,
  tdId?: number,
): Promise<Matches & { hasProfile: boolean; measured: IdeologyDimension[] }> {
  const w = weightsParam(weights);
  const params: string[] = [];
  if (w) params.push(`weights=${encodeURIComponent(w)}`);
  if (tdId !== undefined) params.push(`td=${tdId}`);
  const { data, meta } = await apiEnvelope<Matches, { hasProfile: boolean; measured: IdeologyDimension[] }>(
    "GET",
    `/api/ideology/me/matches${params.length > 0 ? `?${params.join("&")}` : ""}`,
  );
  return { ...data, hasProfile: meta?.hasProfile ?? true, measured: meta?.measured ?? [] };
}

/** The TD profile's ideology card: position, baseline flag and the evidence behind it. */
export async function fetchTdIdeology(tdId: number): Promise<TdIdeology> {
  return apiCall<TdIdeology>("GET", `/api/ideology/td/${tdId}`);
}

const partyPath = (party: string) => `/api/ideology/party/${encodeURIComponent(party)}`;

/** A party's position (its TD mean blended with its manifesto); null when it has none. */
export async function fetchPartyIdeology(party: string): Promise<PartyIdeology | null> {
  return orNullOn404(apiCall<PartyIdeology>("GET", partyPath(party)));
}

/** A party's reviewed manifesto answers with their quotes; null for an unknown party. */
export async function fetchPartyAnswers(party: string): Promise<PartyAnswers | null> {
  return orNullOn404(apiCall<PartyAnswers>("GET", `${partyPath(party)}/answers`));
}

/** Public: matches for a vector that is not saved (anonymous quiz takers). */
export async function fetchMatchesForVector(
  vector: IdeologyVector,
  weights?: Partial<DimensionWeights>,
): Promise<Matches> {
  return apiCall<Matches>("POST", "/api/ideology/matches", { vector, weights });
}

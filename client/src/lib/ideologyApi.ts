/**
 * Client calls for the quiz and ideology endpoints (server/routes/quiz.ts, server/routes/ideology.ts).
 *
 * Every endpoint answers `{ success: true, data, meta? }` or `{ success: false, error }`; these helpers
 * unwrap `data` so callers never read the envelope.
 */
import { apiRequest } from "@/lib/queryClient";
import { IDEOLOGY_DIMENSIONS } from "@shared/ideology";
import type { IdeologyDimension, IdeologyVector } from "@shared/ideology";
import type { Matches, PartyAnswers, PartyIdeology, PartyQuizAnswer, TdIdeology, UserIdeologyDetail } from "@shared/ideologyMatch";
import type { QuizResponse, QuizResult } from "@shared/quiz";

export type { Matches, PartyAnswers, PartyIdeology, PartyMatch, PartyQuizAnswer, TdMatch } from "@shared/ideologyMatch";

type Envelope<T, M = undefined> =
  | { success: true; data: T; meta?: M }
  | { success: false; error: string };

/** Per-dimension importance, 0..3 (1 = neutral). */
export type DimensionWeights = Record<IdeologyDimension, number>;

export interface IdeologyTimeline {
  points: { date: string; vector: IdeologyVector }[];
  party: PartyIdeology | null;
}

async function call<T, M = undefined>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: T; meta?: M }> {
  const res = await apiRequest<Envelope<T, M>>({ method, path, body });
  if (!res || !res.success) {
    throw new Error(res && !res.success ? res.error : "Empty response");
  }
  return { data: res.data, meta: res.meta };
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
  return (await call<QuizResult>("POST", "/api/quiz", { answers, seed })).data;
}

/** Signed-in user's saved results, newest first. */
export async function fetchMyQuizResults(): Promise<QuizResult[]> {
  return (await call<QuizResult[]>("GET", "/api/quiz/me")).data;
}

/** Signed-in user's current position with its confidence per dimension; null until they take the quiz or vote. */
export async function fetchMyIdeology(): Promise<UserIdeologyDetail | null> {
  const { data } = await call<UserIdeologyDetail | { vector: null; confidence: null }>("GET", "/api/ideology/me");
  return data.vector === null ? null : data;
}

export async function fetchMyTimeline(party?: string): Promise<IdeologyTimeline> {
  const qs = party ? `?party=${encodeURIComponent(party)}` : "";
  return (await call<IdeologyTimeline>("GET", `/api/ideology/me/timeline${qs}`)).data;
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
  const { data, meta } = await call<Matches, { hasProfile: boolean; measured: IdeologyDimension[] }>(
    "GET",
    `/api/ideology/me/matches${params.length > 0 ? `?${params.join("&")}` : ""}`,
  );
  return { ...data, hasProfile: meta?.hasProfile ?? true, measured: meta?.measured ?? [] };
}

/** The TD profile's ideology card: position, baseline flag and the evidence behind it. */
export async function fetchTdIdeology(tdId: number): Promise<TdIdeology> {
  return (await call<TdIdeology>("GET", `/api/ideology/td/${tdId}`)).data;
}

/** The request's result, or null when the server answers 404 (apiRequest throws "404: …"). */
async function orNullOn404<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("404:")) return null;
    throw error;
  }
}

const partyPath = (party: string) => `/api/ideology/party/${encodeURIComponent(party)}`;

/** A party's position (its TD mean blended with its manifesto); null when it has none. */
export async function fetchPartyIdeology(party: string): Promise<PartyIdeology | null> {
  return orNullOn404(call<PartyIdeology>("GET", partyPath(party)).then((r) => r.data));
}

/** A party's reviewed manifesto answers with their quotes; null for an unknown party. */
export async function fetchPartyAnswers(party: string): Promise<PartyAnswers | null> {
  return orNullOn404(call<PartyAnswers>("GET", `${partyPath(party)}/answers`).then((r) => r.data));
}

/** Every party's reviewed answers to each question, at most 60 ids per call. */
export async function fetchPartyAnswersFor(questionIds: number[]): Promise<Record<number, PartyQuizAnswer[]>> {
  return (await call<Record<number, PartyQuizAnswer[]>>("GET", `/api/ideology/party-answers?questions=${questionIds.join(",")}`)).data;
}

/** Public: matches for a vector that is not saved (anonymous quiz takers). */
export async function fetchMatchesForVector(
  vector: IdeologyVector,
  weights?: Partial<DimensionWeights>,
): Promise<Matches> {
  return (await call<Matches>("POST", "/api/ideology/matches", { vector, weights })).data;
}

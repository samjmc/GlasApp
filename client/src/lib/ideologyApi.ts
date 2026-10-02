/**
 * Client calls for the quiz and ideology endpoints (server/routes/quiz.ts, server/routes/ideology.ts).
 *
 * Every endpoint answers `{ success: true, data, meta? }` or `{ success: false, error }`; these helpers
 * unwrap `data` so callers never read the envelope.
 */
import { apiRequest } from "@/lib/queryClient";
import { IDEOLOGY_DIMENSIONS } from "@shared/ideology";
import type { IdeologyDimension, IdeologyVector } from "@shared/ideology";
import type { Matches, TdIdeology, UserIdeologyDetail } from "@shared/ideologyMatch";
import type { QuizResponse, QuizResult } from "@shared/quiz";

export type { Matches, PartyMatch, TdMatch } from "@shared/ideologyMatch";

type Envelope<T, M = undefined> =
  | { success: true; data: T; meta?: M }
  | { success: false; error: string };

/** Per-dimension importance, 0..3 (1 = neutral). */
export type DimensionWeights = Record<IdeologyDimension, number>;

export interface PartyProfile {
  party: string;
  vector: IdeologyVector;
  tdCount: number;
  computedAt: string;
}

export interface IdeologyTimeline {
  points: { date: string; vector: IdeologyVector }[];
  party: PartyProfile | null;
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

export async function submitQuiz(answers: QuizResponse[]): Promise<QuizResult> {
  return (await call<QuizResult>("POST", "/api/quiz", { answers })).data;
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

/** Public: matches for a vector that is not saved (anonymous quiz takers). */
export async function fetchMatchesForVector(
  vector: IdeologyVector,
  weights?: Partial<DimensionWeights>,
): Promise<Matches> {
  return (await call<Matches>("POST", "/api/ideology/matches", { vector, weights })).data;
}

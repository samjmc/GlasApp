/**
 * Client calls for the quiz and ideology endpoints (server/routes/quiz.ts, server/routes/ideology.ts).
 *
 * Every endpoint answers `{ success: true, data, meta? }` or `{ success: false, error }`; these helpers
 * unwrap `data` so callers never read the envelope.
 */
import { apiRequest } from "@/lib/queryClient";
import { IDEOLOGY_DIMENSIONS } from "@shared/ideology";
import type { IdeologyDimension, IdeologyVector } from "@shared/ideology";
import type { QuizResponse, QuizResult } from "@shared/quiz";

type Envelope<T, M = undefined> =
  | { success: true; data: T; meta?: M }
  | { success: false; error: string };

/** Per-dimension importance, 0..3 (1 = neutral). */
export type DimensionWeights = Record<IdeologyDimension, number>;

export interface TdMatch {
  tdId: number;
  name: string;
  party: string;
  constituency: string;
  imageUrl: string | null;
  alignment: number;
  evidenceCount: number;
  closest: IdeologyDimension[];
  furthest: IdeologyDimension[];
}

export interface PartyMatch {
  party: string;
  alignment: number;
  tdCount: number;
  closest: IdeologyDimension[];
  furthest: IdeologyDimension[];
}

export interface Matches {
  tds: TdMatch[];
  parties: PartyMatch[];
}

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

/** Signed-in user's current profile; null until they take the quiz or vote. */
export async function fetchMyIdeology(): Promise<IdeologyVector | null> {
  return (await call<{ vector: IdeologyVector | null }>("GET", "/api/ideology/me")).data.vector;
}

export async function fetchMyTimeline(party?: string): Promise<IdeologyTimeline> {
  const qs = party ? `?party=${encodeURIComponent(party)}` : "";
  return (await call<IdeologyTimeline>("GET", `/api/ideology/me/timeline${qs}`)).data;
}

export async function fetchMyMatches(
  weights?: Partial<DimensionWeights>,
): Promise<Matches & { hasProfile: boolean }> {
  const w = weightsParam(weights);
  const { data, meta } = await call<Matches, { hasProfile: boolean }>(
    "GET",
    `/api/ideology/me/matches${w ? `?weights=${encodeURIComponent(w)}` : ""}`,
  );
  return { ...data, hasProfile: meta?.hasProfile ?? true };
}

/** Public: matches for a vector that is not saved (anonymous quiz takers). */
export async function fetchMatchesForVector(
  vector: IdeologyVector,
  weights?: Partial<DimensionWeights>,
): Promise<Matches> {
  return (await call<Matches>("POST", "/api/ideology/matches", { vector, weights })).data;
}

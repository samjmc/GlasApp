/**
 * Browser storage for the quiz. Every access is wrapped: storage can throw (private mode,
 * blocked site data) and the quiz must still work without it.
 *
 * sessionStorage holds the last scored result and the answers behind it, so an anonymous
 * result survives navigation and can be saved once the user signs in. localStorage holds
 * only the viewer's match-weight preference.
 */
import { IDEOLOGY_DIMENSIONS } from "@shared/ideology";
import type { QuizResponse, QuizResult } from "@shared/quiz";
import { defaultWeights, type DimensionWeights } from "@/lib/ideologyApi";

const RESULT_KEY = "glas.quiz.result";
const ANSWERS_KEY = "glas.quiz.answers";
const DRAFT_KEY = "glas.quiz.draft";
const WEIGHTS_KEY = "dimensionWeights";

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: unknown): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the page keeps working from memory.
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

export interface StoredQuiz {
  result: QuizResult;
  answers: QuizResponse[];
}

export function loadStoredQuiz(): StoredQuiz | null {
  const result = read<QuizResult>(session, RESULT_KEY);
  if (!result || !result.vector) return null;
  return { result, answers: read<QuizResponse[]>(session, ANSWERS_KEY) ?? [] };
}

export function storeQuiz(result: QuizResult, answers: QuizResponse[]): void {
  write(session, RESULT_KEY, result);
  write(session, ANSWERS_KEY, answers);
}

export function clearStoredQuiz(): void {
  write(session, RESULT_KEY, null);
  write(session, ANSWERS_KEY, null);
}

/** In-progress answers, keyed by question id, so a reload does not lose them. */
export function loadDraft(): Record<number, number> {
  return read<Record<number, number>>(session, DRAFT_KEY) ?? {};
}

export function storeDraft(draft: Record<number, number> | null): void {
  write(session, DRAFT_KEY, draft);
}

export function loadWeights(): DimensionWeights {
  const saved = read<Partial<DimensionWeights>>(local, WEIGHTS_KEY) ?? {};
  const weights = defaultWeights();
  for (const d of IDEOLOGY_DIMENSIONS) {
    const w = saved[d];
    if (typeof w === "number" && Number.isFinite(w)) weights[d] = Math.max(0, Math.min(3, w));
  }
  return weights;
}

export function storeWeights(weights: DimensionWeights): void {
  write(local, WEIGHTS_KEY, weights);
}

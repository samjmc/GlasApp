/**
 * Browser storage for the quiz. Every access is wrapped: storage can throw (private mode,
 * blocked site data) and the quiz must still work without it.
 *
 * sessionStorage holds the last scored result, the answers and seed behind it, so an anonymous
 * result survives navigation and can be saved once the user signs in. localStorage holds the
 * viewer's match-weight preference and the device's quiz seed (reused on retake).
 */
import { IDEOLOGY_DIMENSIONS } from "@shared/ideology";
import type { QuizResponse, QuizResult } from "@shared/quiz";
import { isQuizSeed } from "@shared/quizPlan";
import { defaultWeights, type DimensionWeights } from "@/lib/ideologyApi";

const RESULT_KEY = "glas.quiz.result";
const ANSWERS_KEY = "glas.quiz.answers";
const RESULT_SEED_KEY = "glas.quiz.resultSeed";
const DRAFT_KEY = "glas.quiz.draft";
const OWNER_KEY = "glas.quiz.owner";
const DEVICE_SEED_KEY = "glas.quiz.seed";
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
  /** The seed the quiz was planned from; absent for a result stored before seeds existed. */
  seed?: number;
}

export function loadStoredQuiz(): StoredQuiz | null {
  const result = read<QuizResult>(session, RESULT_KEY);
  if (!result || !result.vector) return null;
  const seed = read<unknown>(session, RESULT_SEED_KEY);
  return { result, answers: read<QuizResponse[]>(session, ANSWERS_KEY) ?? [], ...(isQuizSeed(seed) ? { seed } : {}) };
}

/**
 * Counts how often the tab's quiz has been cleared (a sign-out, a different person, a withdrawal). A save
 * that started before a clear and finishes after it carries the epoch it started in, and storeQuiz then
 * drops it: its result belongs to someone who has gone (or was erased), and writing it back would show it
 * to the next person as saved.
 */
let epoch = 0;
export const quizStorageEpoch = () => epoch;

/** `startedAt`: the epoch when the save began; the result is not stored if the tab's quiz was cleared since. */
export function storeQuiz(result: QuizResult, answers: QuizResponse[], seed?: number, startedAt?: number): void {
  if (startedAt !== undefined && startedAt !== epoch) return;
  write(session, RESULT_KEY, result);
  write(session, ANSWERS_KEY, answers);
  write(session, RESULT_SEED_KEY, seed ?? null);
}

export function clearStoredQuiz(): void {
  write(session, RESULT_KEY, null);
  write(session, ANSWERS_KEY, null);
  write(session, RESULT_SEED_KEY, null);
}

/**
 * Everything of the person's quiz that the tab holds: the result, its answers and seed, and the
 * in-progress draft. For a sign-out, a different person signing in, and a withdrawal of consent (the
 * server has erased what these were copies of). The device's seed and the match weights stay: they are
 * not opinions about a person.
 */
export function clearAllQuizStorage(): void {
  epoch++;
  clearStoredQuiz();
  write(session, DRAFT_KEY, null);
  write(session, OWNER_KEY, null);
}

/** The signed-in person this tab's quiz was last kept for, or null (an anonymous visitor's, or none). */
export function loadQuizOwner(): string | null {
  const owner = read<unknown>(session, OWNER_KEY);
  return typeof owner === "string" && owner ? owner : null;
}

export function storeQuizOwner(userId: string): void {
  write(session, OWNER_KEY, userId);
}

/** An in-progress quiz: its seed and the answers so far (question id → answer index). */
export interface QuizDraft {
  seed: number;
  answers: Record<number, number>;
}

/** A stored draft, or null. A draft without a valid seed (the old answers-only shape) is discarded. */
export function parseDraft(raw: unknown): QuizDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const { seed, answers } = raw as Partial<QuizDraft>;
  if (!isQuizSeed(seed) || !answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  return { seed, answers };
}

/** The in-progress quiz, so a reload does not lose it. */
export function loadDraft(): QuizDraft | null {
  return parseDraft(read<unknown>(session, DRAFT_KEY));
}

export function storeDraft(draft: QuizDraft | null): void {
  write(session, DRAFT_KEY, draft);
}

/** This device's quiz seed: the same questions on a retake (decision 14). */
export function loadDeviceSeed(): number | null {
  const seed = read<unknown>(local, DEVICE_SEED_KEY);
  return isQuizSeed(seed) ? seed : null;
}

export function storeDeviceSeed(seed: number): void {
  write(local, DEVICE_SEED_KEY, seed);
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

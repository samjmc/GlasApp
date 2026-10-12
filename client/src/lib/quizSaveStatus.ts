/** Where the results page's save of an unsaved result got to. 'idle': not started yet. */
export type QuizSaveAttempt = "idle" | "saving" | "declined" | "failed";

/** What the "Keep this result" box shows. */
export type QuizSaveStatus = "signedOut" | "saving" | "saved" | "declined" | "failed";

/**
 * A saved result (it has an id) is saved whatever the attempt says. A signed-in user's unsaved
 * result is saving until the attempt ends; a decline or a failure must say so, never "Saving…".
 */
export function quizSaveStatus(isAuthenticated: boolean, resultId: number | null, attempt: QuizSaveAttempt): QuizSaveStatus {
  if (resultId !== null) return "saved";
  if (!isAuthenticated) return "signedOut";
  return attempt === "idle" ? "saving" : attempt;
}

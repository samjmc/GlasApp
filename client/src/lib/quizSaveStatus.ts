/** Where the results page's save of an unsaved result got to. 'idle': not started yet. */
export type QuizSaveAttempt = "idle" | "saving" | "declined" | "failed";

/** What the "Keep this result" box shows. */
export type QuizSaveStatus = "signedOut" | "saving" | "saved" | "declined" | "failed" | "noAnswers";

/**
 * A saved result (it has an id) is saved whatever the attempt says. A signed-in user's unsaved
 * result is saving until the attempt ends; a decline or a failure must say so, never "Saving…".
 * Without the answers behind it (the tab no longer holds them) the result cannot be saved at all:
 * the page never starts a save, so that must not read as "Saving…" either.
 */
export function quizSaveStatus(
  isAuthenticated: boolean,
  resultId: number | null,
  attempt: QuizSaveAttempt,
  hasAnswers: boolean,
): QuizSaveStatus {
  if (resultId !== null) return "saved";
  if (!isAuthenticated) return "signedOut";
  if (!hasAnswers) return "noAnswers";
  return attempt === "idle" ? "saving" : attempt;
}

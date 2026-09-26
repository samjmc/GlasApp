/**
 * Choosing today's questions for one user. Pure and deterministic: the same inputs
 * always give the same session, so it can be tested exactly.
 */
import type { IdeologyDimension } from '../constants/ideology';

export interface QuestionCandidate {
  questionId: number;
  primaryDimension: IdeologyDimension | null;
  createdAt: Date;
}

/**
 * Pick up to `count` questions. Each pick prefers, in order:
 *  1. an axis not already chosen for today,
 *  2. the axis this user has answered the fewest times lately (`recentAnswersByAxis`),
 *  3. a question with a named axis over one without,
 *  4. the newest question.
 * Candidates are expected to exclude questions the user has already answered.
 */
export function selectDailyQuestions(
  candidates: QuestionCandidate[],
  recentAnswersByAxis: Partial<Record<IdeologyDimension, number>>,
  count: number,
): number[] {
  const remaining = [...candidates];
  const chosenAxes = new Set<IdeologyDimension>();
  const picked: number[] = [];

  const answered = (axis: IdeologyDimension | null) =>
    axis === null ? Number.POSITIVE_INFINITY : (recentAnswersByAxis[axis] ?? 0);

  while (picked.length < count && remaining.length > 0) {
    remaining.sort((a, b) => {
      const repeatA = a.primaryDimension !== null && chosenAxes.has(a.primaryDimension) ? 1 : 0;
      const repeatB = b.primaryDimension !== null && chosenAxes.has(b.primaryDimension) ? 1 : 0;
      if (repeatA !== repeatB) return repeatA - repeatB;

      const answeredA = answered(a.primaryDimension);
      const answeredB = answered(b.primaryDimension);
      if (answeredA !== answeredB) return answeredA - answeredB;

      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.questionId - a.questionId;
    });

    const next = remaining.shift()!;
    picked.push(next.questionId);
    if (next.primaryDimension !== null) chosenAxes.add(next.primaryDimension);
  }

  return picked;
}

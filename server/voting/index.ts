/**
 * Voting's public interface. Other domains import from here and never from the voting
 * tables or files inside this folder.
 *
 * - News calls `getQuestionsForArticles` to show a question on each feed card.
 * - The news pipeline calls `generateQuestionForArticle` for an article with a verified TD stance.
 * - The ideology domain calls `listUserVoteVectors` to fold votes into a profile.
 * - The stance domain reads `questionForArticle` / `questionsWithPositions` to match what a TD
 *   said to an answer, and makes its model calls through `completeJson`.
 *
 * The HTTP routers are deliberately NOT exported here: importing them loads the auth
 * module, which needs Supabase settings a background job may not have. server/routes.ts
 * imports them from ./routes directly.
 */
export { completeJson, generateQuestionForArticle, getQuestionsForArticles, type CompleteJson } from './service';
export type { OptionVector, QuestionArticle } from './questions';

import type { OptionVector } from './questions';
import {
  questionsByIds,
  questionsForArticles,
  userVoteVectors,
  vectorOf,
  type QuestionWithOptions,
  type UserVoteVector,
} from './repository';

/** Every option this user has chosen, oldest first, with its position on the eight axes. */
export function listUserVoteVectors(userId: string, since?: Date): Promise<UserVoteVector[]> {
  return userVoteVectors(userId, since);
}
export type { UserVoteVector };

/** A question and its options, each with its position on the eight axes (−2..+2). */
export interface QuestionPositions {
  id: number;
  articleId: number;
  question: string;
  policyTopic: string;
  options: Array<{ key: string; label: string; vector: OptionVector; weight: number; confidence: number | null }>;
}

const toPositions = ({ question, options }: QuestionWithOptions): QuestionPositions => ({
  id: question.id,
  articleId: question.articleId,
  question: question.question,
  policyTopic: question.policyTopic,
  options: options.map((option) => ({
    key: option.optionKey,
    label: option.label,
    vector: vectorOf(option),
    weight: option.weight,
    confidence: option.confidence,
  })),
});

/** The article's daily-vote question, or null when it has none. */
export async function questionForArticle(articleId: number): Promise<QuestionPositions | null> {
  const [found] = await questionsForArticles([articleId]);
  return found ? toPositions(found) : null;
}

export async function questionsWithPositions(questionIds: number[]): Promise<QuestionPositions[]> {
  return (await questionsByIds(questionIds)).map(toPositions);
}

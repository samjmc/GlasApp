/**
 * Voting's public interface. Other domains import from here and never from the voting
 * tables or files inside this folder.
 *
 * - News calls `getQuestionsForArticles` to show a question on each feed card.
 * - The scoring pipeline calls `generateQuestionForArticle` after scoring an article.
 * - The ideology domain calls `listUserVoteVectors` to fold votes into a profile.
 *
 * The HTTP routers are deliberately NOT exported here: importing them loads the auth
 * module, which needs Supabase settings a background job may not have. server/routes.ts
 * imports them from ./routes directly.
 */
export { generateQuestionForArticle, getQuestionsForArticles } from './service';
export type { QuestionArticle } from './questions';

import { userVoteVectors, type UserVoteVector } from './repository';

/** Every option this user has chosen, oldest first, with its position on the eight axes. */
export function listUserVoteVectors(userId: string, since?: Date): Promise<UserVoteVector[]> {
  return userVoteVectors(userId, since);
}
export type { UserVoteVector };

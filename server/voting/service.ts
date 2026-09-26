/**
 * Voting use cases: make a question from an article, build and run the daily session,
 * and cast a vote from any surface. The pure decisions live in questions.ts,
 * selection.ts and summary.ts; this file sequences them around the repository.
 */
import { callChatCompletion, isLLMConfigured } from '../services/aiService';
import { generateQuickExplainer } from '../services/openaiService';
import type { IdeologyDimension } from '../constants/ideology';
import {
  DAILY_ITEM_COUNT,
  type ArticleQuestion,
  type DailySessionItem,
  type DailySessionState,
  type DailySessionCompletion,
  type QuestionTally,
  type QuickExplainer,
  type VoteSource,
} from '@shared/voting';
import type { DailySessionRow } from '@shared/schema/voting';
import * as repo from './repository';
import * as ideology from './ideology';
import {
  assembleQuestion,
  parseOptionPositions,
  parseQuestion,
  pickTargetDimension,
  questionPrompt,
  shouldCreateQuestion,
  vectorPrompt,
  type QuestionArticle,
} from './questions';
import { selectDailyQuestions } from './selection';
import {
  buildCompletion,
  computeShifts,
  computeStreak,
  leanOf,
  rankAxes,
  sessionDateFor,
  summariseRegion,
} from './summary';

/** Questions older than this are not offered in a new session. */
const CANDIDATE_WINDOW_DAYS = 14;
const CANDIDATE_LIMIT = 60;
/** How far back a user's answers count when balancing axes. */
const ANSWER_HISTORY_DAYS = 30;
/** How far back question targets count when steering the next question's axis. */
const QUESTION_BALANCE_DAYS = 30;
const QUESTION_MODEL = 'gpt-4o-mini';
const EXPLAINER_TTL_MS = 24 * 60 * 60 * 1000;
const EXPLAINER_CACHE_MAX = 500;

/** A failure the caller caused. The router maps `status` straight to the response. */
export class VotingError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

const daysAgo = (days: number, now: Date) => new Date(now.getTime() - days * 86_400_000);

const previousDate = (isoDate: string) =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Question generation
// ---------------------------------------------------------------------------

/** Ask the model for a JSON object. Null when unconfigured or when it fails to parse. */
export async function completeJson(system: string, user: string, temperature: number, operation: string): Promise<unknown> {
  if (!isLLMConfigured()) return null;
  try {
    const response = await callChatCompletion(
      {
        model: QUESTION_MODEL,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      { operation },
    );
    const content = response.choices[0]?.message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.warn(`[voting] ${operation} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export type CompleteJson = typeof completeJson;

/**
 * Make and save a question for one article. Returns the new question's id, or null when
 * the article already has one, does not support a question, or the model output was
 * unusable.
 */
export async function generateQuestionForArticle(
  article: QuestionArticle,
  options: { force?: boolean } = {},
  complete: CompleteJson = completeJson,
  now: Date = new Date(),
): Promise<number | null> {
  if (await repo.hasQuestionForArticle(article.id)) return null;

  const target = pickTargetDimension(await repo.primaryDimensionCounts(daysAgo(QUESTION_BALANCE_DAYS, now)));
  const question = parseQuestion(
    await complete(
      'You create unbiased, scenario-based political questions. Respond ONLY with valid JSON.',
      questionPrompt(article, target),
      0.2,
      'policyQuestion',
    ),
  );
  if (!question || !shouldCreateQuestion(question, options.force)) return null;

  const positions = parseOptionPositions(
    await complete(
      'You map policy vote options to ideology axis positions. Respond ONLY with valid JSON.',
      vectorPrompt(question),
      0.1,
      'optionPositions',
    ),
    question.options.map((option) => option.key),
  );
  if (!positions) return null;

  const saved = await repo.saveQuestion(assembleQuestion(article, question, positions));
  return saved.created ? saved.id : null;
}

// ---------------------------------------------------------------------------
// Casting a vote: the one write path, whichever surface calls it
// ---------------------------------------------------------------------------

export async function castVote(input: {
  userId: string;
  questionId: number;
  optionKey: string;
  source: VoteSource;
  sessionItemId?: number | null;
}): Promise<void> {
  const found = await repo.questionById(input.questionId);
  if (!found) throw new VotingError(404, 'Question not found');
  if (!found.options.some((option) => option.optionKey === input.optionKey)) {
    throw new VotingError(400, 'That is not one of the options for this question');
  }

  await repo.upsertVote({ ...input, sessionItemId: input.sessionItemId ?? null });

  // The vote is recorded either way; a failed recompute only delays the profile update.
  try {
    await ideology.recomputeProfile(input.userId);
  } catch (error) {
    console.error('[voting] ideology recompute failed:', error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------------------
// The daily session
// ---------------------------------------------------------------------------

async function stateOf(session: DailySessionRow, userId: string): Promise<DailySessionState> {
  const items = await repo.sessionItems(session.id, userId);
  const view: DailySessionItem[] = items.map((item) => ({
    sessionItemId: item.itemId,
    questionId: item.question.id,
    articleId: item.question.articleId,
    headline: item.question.headline,
    summary: item.question.summary ?? '',
    prompt: item.question.question,
    answerOptions: Object.fromEntries(item.options.map((option) => [option.optionKey, option.label])),
    policyDimension: item.question.primaryDimension,
    contextNote: item.question.policyTopic.replace(/_/g, ' '),
    orderIndex: item.position,
    hasVoted: item.selectedOption !== null,
    selectedOption: item.selectedOption,
    articleUrl: item.question.articleUrl,
    imageUrl: item.question.imageUrl,
  }));

  return {
    status: session.status === 'completed' ? 'completed' : 'pending',
    sessionId: session.id,
    sessionDate: session.sessionDate,
    voteCount: view.filter((item) => item.hasVoted).length,
    streakCount: session.streakCount ?? 0,
    items: view,
    completion: session.completion ?? undefined,
  };
}

export interface SessionUser {
  id: string;
  county: string | null;
  constituency: string | null;
}

/**
 * Today's session, created on first request. When there is nothing to ask, returns an
 * empty pending state WITHOUT saving it, so questions that arrive later in the day can
 * still make a session.
 */
export async function getOrCreateSession(user: SessionUser, now: Date = new Date()): Promise<DailySessionState> {
  const sessionDate = sessionDateFor(now);
  const existing = await repo.findSession(user.id, sessionDate);
  if (existing) return stateOf(existing, user.id);

  const [candidates, answered] = await Promise.all([
    repo.unansweredCandidates(user.id, daysAgo(CANDIDATE_WINDOW_DAYS, now), CANDIDATE_LIMIT),
    repo.answeredAxisCounts(user.id, daysAgo(ANSWER_HISTORY_DAYS, now)),
  ]);
  const questionIds = selectDailyQuestions(candidates, answered, DAILY_ITEM_COUNT);

  if (questionIds.length === 0) {
    return { status: 'pending', sessionId: 0, sessionDate, voteCount: 0, streakCount: 0, items: [] };
  }

  const session = await repo.createSession({
    userId: user.id,
    sessionDate,
    county: user.county,
    constituency: user.constituency,
    profileBefore: await ideology.getIdeologyProfile(user.id),
    questionIds,
  });
  return stateOf(session, user.id);
}

export async function recordSessionVote(
  userId: string,
  sessionItemId: number,
  optionKey: string,
  now: Date = new Date(),
): Promise<DailySessionState> {
  const item = await repo.itemForUser(sessionItemId, userId);
  if (!item) throw new VotingError(404, 'Session item not found');
  if (item.session.status === 'completed') throw new VotingError(409, 'Today’s session is already complete');
  if (item.session.sessionDate !== sessionDateFor(now)) throw new VotingError(409, 'That session has ended');

  await castVote({ userId, questionId: item.questionId, optionKey, source: 'daily_session', sessionItemId });
  return stateOf(item.session, userId);
}

export async function completeSession(userId: string, now: Date = new Date()): Promise<DailySessionCompletion> {
  const sessionDate = sessionDateFor(now);
  const session = await repo.findSession(userId, sessionDate);
  if (!session) throw new VotingError(404, 'No session today');
  if (session.status === 'completed' && session.completion) return session.completion;

  const items = await repo.sessionItems(session.id, userId);
  const voteCount = items.filter((item) => item.selectedOption !== null).length;
  if (voteCount < items.length) throw new VotingError(400, 'Answer every question before finishing');

  const [profileAfter, votes, earlierDates] = await Promise.all([
    ideology.getIdeologyProfile(userId),
    repo.sessionVoteVectors(session.id, userId),
    repo.completedDatesBefore(userId, sessionDate),
  ]);
  const shifts = computeShifts(session.profileBefore, profileAfter);
  const lean = leanOf(votes);
  const focus: IdeologyDimension | null =
    (shifts[0]?.ideologyDimension as IdeologyDimension | undefined) ?? (lean ? rankAxes(lean)[0] ?? null : null);

  const kind = session.county ? 'county' : session.constituency ? 'constituency' : null;
  const name = session.county ?? session.constituency;
  let region = summariseRegion({ kind: null, name: null, finishedToday: 0, today: {}, yesterday: null }, focus);
  if (kind && name) {
    const [today, yesterday] = await Promise.all([
      repo.regionTotals(sessionDate, kind, name),
      repo.regionTotals(previousDate(sessionDate), kind, name),
    ]);
    // This session is not marked complete yet, so add its own votes to today's area.
    const withMine = { ...today.totals };
    for (const vote of votes) {
      for (const axis of Object.keys(vote.vector) as IdeologyDimension[]) {
        withMine[axis] = (withMine[axis] ?? 0) + vote.vector[axis] * vote.weight;
      }
    }
    region = summariseRegion(
      {
        kind,
        name,
        finishedToday: today.finished + 1,
        today: withMine,
        yesterday: yesterday.finished > 0 ? yesterday.totals : null,
      },
      focus,
    );
  }

  const completion = buildCompletion({
    shifts,
    lean,
    streakCount: computeStreak(earlierDates, sessionDate),
    voteCount,
    itemCount: items.length,
    region,
  });

  if (!(await repo.completeSession(session.id, completion.streakCount, completion))) {
    // A concurrent request finished it first; return what that request stored.
    const stored = await repo.findSession(userId, sessionDate);
    if (stored?.completion) return stored.completion;
  }
  return completion;
}

// ---------------------------------------------------------------------------
// Article surface
// ---------------------------------------------------------------------------

const toArticleQuestion = (found: repo.QuestionWithOptions): ArticleQuestion => ({
  id: found.question.id,
  question: found.question.question,
  options: Object.fromEntries(found.options.map((option) => [option.optionKey, option.label])),
  domain: found.question.policyDomain,
  topic: found.question.policyTopic,
});

export async function getQuestionsForArticles(articleIds: number[]): Promise<Map<number, ArticleQuestion>> {
  const found = await repo.questionsForArticles(articleIds);
  return new Map(found.map((q) => [q.question.articleId, toArticleQuestion(q)]));
}

export interface ArticleVoteView {
  question: ArticleQuestion | null;
  tally: QuestionTally;
  myVote: string | null;
}

const EMPTY_TALLY: QuestionTally = { total: 0, byOption: {} };

export async function articleVoteView(articleId: number, userId: string | null): Promise<ArticleVoteView> {
  const [found] = await repo.questionsForArticles([articleId]);
  if (!found) return { question: null, tally: EMPTY_TALLY, myVote: null };
  const [tallies, myVote] = await Promise.all([
    repo.tallies([found.question.id]),
    userId ? repo.userVote(userId, found.question.id) : Promise.resolve(null),
  ]);
  return { question: toArticleQuestion(found), tally: tallies.get(found.question.id) ?? EMPTY_TALLY, myVote };
}

export async function castArticleVote(
  userId: string,
  questionId: number,
  optionKey: string,
): Promise<{ tally: QuestionTally; myVote: string }> {
  await castVote({ userId, questionId, optionKey, source: 'article' });
  const tallies = await repo.tallies([questionId]);
  return { tally: tallies.get(questionId) ?? EMPTY_TALLY, myVote: optionKey };
}

export async function retractVote(userId: string, questionId: number): Promise<void> {
  if (!(await repo.deleteVote(userId, questionId))) throw new VotingError(404, 'No vote to remove');
  try {
    await ideology.recomputeProfile(userId);
  } catch (error) {
    console.error('[voting] ideology recompute failed:', error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------------------
// Quick explainer: an LLM summary per headline, cached in process
// ---------------------------------------------------------------------------

const explainerCache = new Map<string, { value: QuickExplainer; expiresAt: number }>();

export async function quickExplainer(input: {
  headline: string;
  summary: string;
  issueCategory: string;
  region: string;
  todayIso?: string;
}): Promise<QuickExplainer> {
  const key = `${input.region}::${input.headline.trim().toLowerCase()}`;
  const cached = explainerCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await generateQuickExplainer(input);
  if (explainerCache.size >= EXPLAINER_CACHE_MAX) {
    // Maps iterate in insertion order, so the first key is the oldest.
    const oldest = explainerCache.keys().next().value;
    if (oldest !== undefined) explainerCache.delete(oldest);
  }
  explainerCache.set(key, { value, expiresAt: Date.now() + EXPLAINER_TTL_MS });
  return value;
}

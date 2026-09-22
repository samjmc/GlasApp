/**
 * HTTP surface for voting. Two routers, both in the `{ success, data }` envelope:
 *
 *   /api/daily-session   GET /                     today's session (created on first call)
 *                        POST /items/:itemId/vote  { optionKey }
 *                        POST /complete            finish and get the summary
 *                        POST /explainer           one-paragraph context for a headline
 *
 *   /api/votes           GET /articles/:articleId        question, tally, and the caller's vote
 *                        POST /questions/:questionId     { optionKey }
 *                        DELETE /questions/:questionId   withdraw the caller's vote
 *
 * Identity is always the verified token's user id; no route reads a user id from input.
 */
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../auth';
import { aiRateLimit } from '../middleware/rateLimit';
import { DEFAULT_REGION_CODE } from '@shared/region-config';
import { OPTION_KEYS } from '@shared/voting';
import { formatError, formatSuccess } from '../utils/responseFormatters';
import * as service from './service';

const idParam = z.coerce.number().int().positive();
const voteBody = z.object({ optionKey: z.enum(OPTION_KEYS) });
const explainerBody = z.object({
  headline: z.string().trim().min(1).max(400),
  summary: z.string().max(4000).default(''),
  issueCategory: z.string().trim().min(1).max(80),
  todayIso: z.string().max(40).optional(),
});

const ERROR_CODES = { 400: 'VALIDATION_ERROR', 404: 'NOT_FOUND', 409: 'CONFLICT' } as const;

/** Run a handler, turning a VotingError into its status and anything else into a 500. */
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const data = await fn(req, res);
      if (!res.headersSent) res.json(formatSuccess(data));
    } catch (error) {
      if (error instanceof service.VotingError) {
        res.status(error.status).json(formatError(ERROR_CODES[error.status], error.message));
      } else if (error instanceof z.ZodError) {
        res.status(400).json(formatError('VALIDATION_ERROR', error.issues[0]?.message ?? 'Invalid request'));
      } else {
        console.error(`[voting] ${req.method} ${req.originalUrl} failed:`, error);
        res.status(500).json(formatError('INTERNAL_ERROR', 'Something went wrong'));
      }
    }
  };

const metadataString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export const dailySessionRouter = Router();

dailySessionRouter.get(
  '/',
  requireAuth,
  handle(async (req) => {
    const user = req.user!;
    // Location is a self-edited preference, so it lives in user_metadata.
    return service.getOrCreateSession({
      id: user.id,
      county: metadataString(user.userMetadata.county),
      constituency: metadataString(user.userMetadata.constituency),
    });
  }),
);

dailySessionRouter.post(
  '/items/:itemId/vote',
  requireAuth,
  handle(async (req) => {
    const { optionKey } = voteBody.parse(req.body);
    return service.recordSessionVote(req.user!.id, idParam.parse(req.params.itemId), optionKey);
  }),
);

dailySessionRouter.post(
  '/complete',
  requireAuth,
  handle(async (req) => service.completeSession(req.user!.id)),
);

dailySessionRouter.post(
  '/explainer',
  requireAuth,
  aiRateLimit,
  handle(async (req) => {
    const body = explainerBody.parse(req.body);
    return service.quickExplainer({ ...body, region: req.regionCode || DEFAULT_REGION_CODE });
  }),
);

export const votesRouter = Router();

votesRouter.get(
  '/articles/:articleId',
  optionalAuth,
  handle(async (req) => service.articleVoteView(idParam.parse(req.params.articleId), req.user?.id ?? null)),
);

votesRouter.post(
  '/questions/:questionId',
  requireAuth,
  handle(async (req) => {
    const { optionKey } = voteBody.parse(req.body);
    return service.castArticleVote(req.user!.id, idParam.parse(req.params.questionId), optionKey);
  }),
);

votesRouter.delete(
  '/questions/:questionId',
  requireAuth,
  handle(async (req) => {
    await service.retractVote(req.user!.id, idParam.parse(req.params.questionId));
    return null;
  }),
);

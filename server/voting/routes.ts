/**
 * HTTP surface for voting. Two routers, both in the `{ success, data }` envelope:
 *
 *   /api/daily-session   GET /                     today's session (created on first call)
 *                        POST /items/:itemId/vote  { optionKey }
 *                        POST /complete            finish and get the summary
 *
 *   /api/votes           GET /articles/:articleId        question, tally, and the caller's vote
 *                        POST /questions/:questionId     { optionKey }
 *
 * Identity is always the verified token's user id; no route reads a user id from input.
 */
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../auth';
import { publicWriteRateLimit } from '../middleware/rateLimit';
import { OPTION_KEYS } from '@shared/voting';
import { formatError, formatSuccess } from '../utils/responseFormatters';
import * as service from './service';

const idParam = z.coerce.number().int().positive();
const voteBody = z.object({ optionKey: z.enum(OPTION_KEYS) });

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

/** A self-edited metadata value, or null when it is blank or longer than its column (`max`). */
const metadataString = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;

export const dailySessionRouter = Router();

dailySessionRouter.get(
  '/',
  requireAuth,
  handle(async (req) => {
    const user = req.user!;
    // Location is a self-edited preference, so it lives in user_metadata.
    return service.getOrCreateSession({
      id: user.id,
      county: metadataString(user.userMetadata.county, 60),
      constituency: metadataString(user.userMetadata.constituency, 100),
    });
  }),
);

dailySessionRouter.post(
  '/items/:itemId/vote',
  requireAuth,
  publicWriteRateLimit,
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

export const votesRouter = Router();

votesRouter.get(
  '/articles/:articleId',
  optionalAuth,
  handle(async (req) => service.articleVoteView(idParam.parse(req.params.articleId), req.user?.id ?? null)),
);

votesRouter.post(
  '/questions/:questionId',
  requireAuth,
  publicWriteRateLimit,
  handle(async (req) => {
    const { optionKey } = voteBody.parse(req.body);
    return service.castArticleVote(req.user!.id, idParam.parse(req.params.questionId), optionKey);
  }),
);

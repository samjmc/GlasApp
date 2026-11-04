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
 * A vote shows a political opinion, so both vote routes need the user's consent (403 CONSENT_REQUIRED).
 * So do opening and finishing the daily session: the session row stores the user's profile and
 * area, and account erasure treats it as political data (server/account/deleteUserData.ts).
 */
import { Router } from 'express';
import { z } from 'zod';
import { requirePoliticalConsent } from '../account/consent';
import { getProfile, userText } from '../account/profile';
import { requireAuth } from '../auth';
import { networkWriteRateLimit, publicWriteRateLimit } from '../middleware/rateLimit';
import { OPTION_KEYS } from '@shared/voting';
import { formatSuccess } from '../utils/responseFormatters';
import * as service from './service';

// A parse failure (ZodError) and the service's AppErrors are answered by the central error handler.
const idParam = z.coerce.number().int().positive();
const voteBody = z.object({ optionKey: z.enum(OPTION_KEYS) });

export const dailySessionRouter = Router();

dailySessionRouter.get('/', requireAuth, requirePoliticalConsent, async (req, res) => {
  const user = req.user!;
  const profile = await getProfile(user.id);
  // County and constituency are profile fields (politics.users). Metadata is where they were saved
  // before; each is read only while the row has never held one. userText also drops a value longer
  // than the session's column.
  const session = await service.getOrCreateSession({
    id: user.id,
    county: userText(profile?.county ?? user.userMetadata.county, 60),
    constituency: userText(profile?.constituency ?? user.userMetadata.constituency, 100),
  });
  res.json(formatSuccess(session));
});

dailySessionRouter.post(
  '/items/:itemId/vote',
  requireAuth,
  requirePoliticalConsent,
  publicWriteRateLimit,
  networkWriteRateLimit,
  async (req, res) => {
    const { optionKey } = voteBody.parse(req.body);
    res.json(formatSuccess(await service.recordSessionVote(req.user!.id, idParam.parse(req.params.itemId), optionKey)));
  },
);

dailySessionRouter.post('/complete', requireAuth, requirePoliticalConsent, async (req, res) => {
  res.json(formatSuccess(await service.completeSession(req.user!.id)));
});

export const votesRouter = Router();

// Public; `req.user` is set for a signed-in caller by the app-wide optionalAuth (server/routes.ts).
votesRouter.get('/articles/:articleId', async (req, res) => {
  res.json(formatSuccess(await service.articleVoteView(idParam.parse(req.params.articleId), req.user?.id ?? null)));
});

votesRouter.post(
  '/questions/:questionId',
  requireAuth,
  requirePoliticalConsent,
  publicWriteRateLimit,
  networkWriteRateLimit,
  async (req, res) => {
    const { optionKey } = voteBody.parse(req.body);
    res.json(formatSuccess(await service.castArticleVote(req.user!.id, idParam.parse(req.params.questionId), optionKey)));
  },
);

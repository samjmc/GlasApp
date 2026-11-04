/**
 * /api/quiz — take the quiz and read your history.
 * Every response is `{ success, data }` via formatSuccess.
 */
import { hasPoliticalConsent } from '../account/consent';
import { requireAuth } from '../auth';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { createRateLimit } from '../middleware/rateLimit';
import { QuizInputError, quizHistory, submitQuiz } from '../quiz';
import { FULL_COVERAGE_ANSWERS, answeredCountsOf } from '../quiz/score';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import type { QuizResponse } from '@shared/quiz';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

/** Quiz submissions: 60 per IP per 15 minutes. Enough for a class taking it on one network; stops a loop. */
const quizSubmitRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 60, name: 'quiz-submit' });

const submitSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.number().int(), answerIndex: z.number().int() }))
    .min(1)
    .max(100),
  /** The seed the client planned the quiz from (shared/quizPlan.ts). Absent = a legacy or scripted submission. */
  seed: z.number().int().min(0).max(0xffffffff).optional(),
});

const INCOMPLETE_QUIZ = `Answer the whole quiz: at least ${FULL_COVERAGE_ANSWERS} questions on each dimension`;

/**
 * A user's profile takes their LATEST quiz only, so a short quiz would wipe a full one's answers on
 * every dimension it skipped. Every plan the client makes asks at least FULL_COVERAGE_ANSWERS
 * questions per dimension (shared/quizPlan.ts), so a submission short of that is not a real quiz.
 */
function isWholeQuiz(answers: QuizResponse[]): boolean {
  const answered = answeredCountsOf(answers);
  return IDEOLOGY_DIMENSIONS.every((d) => answered[d] >= FULL_COVERAGE_ANSWERS);
}

/**
 * POST /api/quiz — score answers. Open to anonymous visitors; saved only when signed in AND the
 * user has consented to us keeping their political opinions. Without consent the answers are
 * scored and returned like an anonymous quiz (`id: null`) and nothing is stored.
 */
router.post(
  '/',
  quizSubmitRateLimit,
  asyncHandler(async (req, res) => {
    const body = submitSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json(formatError('VALIDATION_ERROR', 'Invalid quiz answers', body.error.flatten()));
    if (!isWholeQuiz(body.data.answers)) return res.status(400).json(formatError('VALIDATION_ERROR', INCOMPLETE_QUIZ));
    try {
      const saveFor = req.user && (await hasPoliticalConsent(req.user.id)) ? req.user.id : null;
      res.json(formatSuccess(await submitQuiz(saveFor, body.data.answers, body.data.seed)));
    } catch (error) {
      if (error instanceof QuizInputError) return res.status(400).json(formatError('VALIDATION_ERROR', error.message));
      throw error;
    }
  }),
);

/** GET /api/quiz/me — the signed-in user's quiz results, newest first. */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(formatSuccess(await quizHistory(req.user!.id)));
  }),
);

export default router;

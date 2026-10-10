/**
 * /api/quiz — take the quiz and read your history.
 * Every response is `{ success, data }` via formatSuccess.
 */
import { hasPoliticalConsent } from '../account/consent';
import { requireAuth } from '../auth';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { QuizInputError, quizHistory, submitQuiz } from '../quiz';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

const submitSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.number().int(), answerIndex: z.number().int() }))
    .min(1)
    .max(100),
  /** The seed the client planned the quiz from (shared/quizPlan.ts). Absent = a legacy or scripted submission. */
  seed: z.number().int().min(0).max(0xffffffff).optional(),
});

/**
 * POST /api/quiz — score answers. Open to anonymous visitors; saved only when signed in AND the
 * user has consented to us keeping their political opinions. Without consent the answers are
 * scored and returned like an anonymous quiz (`id: null`) and nothing is stored.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = submitSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json(formatError('VALIDATION_ERROR', 'Invalid quiz answers', body.error.flatten()));
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

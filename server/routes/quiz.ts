/**
 * /api/quiz — take the quiz, read your history, ask the quiz assistant.
 * Every response is `{ success, data }` via formatSuccess.
 */
import { requireAuth } from '../auth';
import { Router } from 'express';
import type OpenAI from 'openai';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { aiRateLimit } from '../middleware/rateLimit';
import { QuizInputError, quizHistory, submitQuiz } from '../quiz';
import { callChatCompletion } from '../services/aiService';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

const submitSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.number().int(), answerIndex: z.number().int() }))
    .min(1)
    .max(100),
});

/** POST /api/quiz — score answers. Open to anonymous visitors; saved only when signed in. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = submitSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json(formatError('Invalid quiz answers', 'VALIDATION_ERROR', body.error.flatten()));
    try {
      res.json(formatSuccess(await submitQuiz(req.user?.id ?? null, body.data.answers)));
    } catch (error) {
      if (error instanceof QuizInputError) return res.status(400).json(formatError(error.message, 'VALIDATION_ERROR'));
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

const assistantSchema = z.object({
  questionText: z.string().max(1000),
  userQuestion: z.string().min(1).max(1000),
  conversationHistory: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});

const ASSISTANT_PROMPT = (questionText: string) => `You are a neutral assistant helping someone understand one question in an Irish political quiz.

Quiz question: "${questionText}"

- Explain the concepts and terms in the question, and the main arguments on each side.
- NEVER say which answer to choose, and do not try to move the user's views.
- Keep it under 150 words, plain and balanced.`;

/** POST /api/quiz/assistant — explain a quiz question. Public, rate-limited. */
router.post(
  '/assistant',
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const body = assistantSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json(formatError('Invalid request', 'VALIDATION_ERROR', body.error.flatten()));
    const { questionText, userQuestion, conversationHistory } = body.data;
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: ASSISTANT_PROMPT(questionText) },
      ...conversationHistory.slice(-10),
      { role: 'user', content: userQuestion },
    ];
    const response = await callChatCompletion({ model: 'gpt-4o', messages, max_tokens: 500, temperature: 0.7 }, { operation: 'quizChat' });
    res.json(formatSuccess({ answer: response.choices[0]?.message.content ?? "Sorry, I couldn't answer that." }));
  }),
);

export default router;

/**
 * The quiz by keyboard (sweep C28): the answers are one tab stop, the arrow keys move between them
 * and select, and a new question's heading takes focus so a screen reader reads it.
 */
import { expect, test } from '@playwright/test';
import { answerOrder, planQuiz } from '@shared/quizPlan';
import { QUIZ_QUESTIONS } from '@shared/quiz';

const SEED = 42;
const BANK = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q]));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true }));
    localStorage.setItem('glas.region', 'IE');
  });
});

test('arrow keys pick an answer, and Next moves focus to the new question', async ({ page }) => {
  await page.goto(`/quiz?seed=${SEED}`);
  await page.getByRole('button', { name: /Start the quiz/ }).click();

  const first = planQuiz(SEED, {}).base[0]!;
  const order = answerOrder(SEED, first, BANK.get(first)!.answers.length);
  const question = page.locator(`[data-testid="quiz-question"][data-question-id="${first}"]`);
  const radios = question.getByRole('radio');
  await expect(radios).toHaveCount(order.length);

  // The heading has focus, and only the first answer is a tab stop until one is picked.
  await expect(question.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(radios.nth(0)).toHaveAttribute('tabindex', '0');
  await expect(radios.nth(1)).toHaveAttribute('tabindex', '-1');

  await radios.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(radios.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(radios.nth(0)).toHaveAttribute('tabindex', '-1');
  await expect(page.getByTestId('quiz-saved-announcement')).toHaveText('Answer saved');

  // Up from the first wraps to the last.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  const last = radios.nth(order.length - 1);
  await expect(last).toBeFocused();
  await expect(last).toHaveAttribute('aria-checked', 'true');
  await expect(last).toHaveAttribute('data-answer-index', String(order[order.length - 1]));

  await page.getByRole('button', { name: /^Next/ }).click();
  const second = planQuiz(SEED, {}).base[1]!;
  await expect(
    page.locator(`[data-testid="quiz-question"][data-question-id="${second}"]`).getByRole('heading', { level: 2 }),
  ).toBeFocused();
});

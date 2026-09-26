/**
 * The anonymous quiz end to end: region, every question, results, party matches. Plus the
 * double-click on Next that used to skip a question.
 *
 * Expectations come from the API, not from hard-coded numbers, so a change to the party
 * blend cannot break this test while the UI still shows what the API says.
 */
import { expect, test, type Page } from '@playwright/test';
import { QUIZ_QUESTIONS, type QuizResponse } from '@shared/quiz';
import { E2E_TDS } from './harness';

/** Per question, the first answer with the highest value. All-max scores +10 on every dimension. */
const MAX = new Map(
  QUIZ_QUESTIONS.map((q) => {
    const top = Math.max(...q.answers.map((a) => a.value));
    return [q.id, q.answers.findIndex((a) => a.value === top)];
  }),
);

const byQuestion = (a: QuizResponse, b: QuizResponse) => a.questionId - b.questionId;

const question = (page: Page) => page.getByTestId('quiz-question');

/** The shown question's id. Waits until it is not `previous`, which skips the exiting container. */
async function questionIdAfter(page: Page, previous: number | null): Promise<number> {
  await expect.poll(async () => Number(await question(page).getAttribute('data-question-id'))).not.toBe(previous ?? 0);
  return Number(await question(page).getAttribute('data-question-id'));
}

async function answer(page: Page, id: number): Promise<void> {
  const button = page.locator(
    `[data-testid="quiz-question"][data-question-id="${id}"] [data-testid="quiz-answer"][data-answer-index="${MAX.get(id)}"]`,
  );
  await button.click();
  await expect(button).toHaveAttribute('aria-checked', 'true');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, analytics: false, functional: false }));
  });
  // The results page asks two LLM routes for write-ups. Never call a model from a test.
  await page.route('**/api/enhanced-profile/**', (route) => route.fulfill({ json: { success: true, data: {} } }));
});

test('anonymous quiz: answers, scores and party matches agree with the API', async ({ page, request }) => {
  test.setTimeout(120_000);
  const submitted = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/quiz');

  await page.goto('/quiz?seed=42');
  await expect(page).toHaveURL(/\/select-region\?next=/);
  await page.getByRole('button', { name: /Continue with Ireland/ }).click();
  await expect(page).toHaveURL(/\/quiz\?seed=42$/);

  await page.getByRole('button', { name: /Start the quiz/ }).click();
  const total = Number(await page.getByRole('progressbar', { name: 'Quiz progress' }).getAttribute('aria-valuemax'));
  expect(total).toBe(QUIZ_QUESTIONS.length);

  const seen: number[] = [];
  for (let i = 0; i < total; i++) {
    const id = await questionIdAfter(page, seen.at(-1) ?? null);
    seen.push(id);
    await answer(page, id);
    await page.getByRole('button', { name: /^(Next|See my results)/ }).click();
  }
  await expect(page).toHaveURL(/\/quiz\/results/);

  expect(new Set(seen).size).toBe(total);
  expect([...seen].sort((a, b) => a - b)).toEqual(QUIZ_QUESTIONS.map((q) => q.id).sort((a, b) => a - b));

  // The UI sent exactly the planned answers.
  const body = (await submitted).postDataJSON() as { answers: QuizResponse[] };
  const planned: QuizResponse[] = seen.map((id) => ({ questionId: id, answerIndex: MAX.get(id)! }));
  expect([...body.answers].sort(byQuestion)).toEqual(planned.sort(byQuestion));

  // The vector the UI shows is what the server scores for that body.
  const ui = await page.evaluate(() => JSON.parse(sessionStorage.getItem('glas.quiz.result') ?? 'null')?.vector);
  const scored = await request.post('/api/quiz', { data: body });
  expect(scored.ok()).toBe(true);
  expect((await scored.json()).data.vector).toEqual(ui);
  expect(Object.values(ui)).toEqual(Array(8).fill(10));

  // The parties shown are the API's, in the API's order.
  const matches = await request.post('/api/ideology/matches', { data: { vector: ui } });
  expect(matches.ok()).toBe(true);
  const names = ((await matches.json()).data.parties as Array<{ party: string }>).map((p) => p.party);
  expect([...names].sort()).toEqual(E2E_TDS.map((td) => td.party).sort());
  expect(names.length, '"Least like you" shows only above five parties').toBeGreaterThan(5);
  await expect(page.getByTestId('party-match-name')).toHaveText(names.slice(0, 3));
  await expect(page.getByTestId('party-match-least-name')).toHaveText([names[5], names[4]]);
});

test('a double-click on Next advances exactly one question', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('glas.region', 'IE'));
  await page.goto('/quiz?seed=42');
  await page.getByRole('button', { name: /Start the quiz/ }).click();
  const first = await questionIdAfter(page, null);
  await answer(page, first);

  const next = page.getByRole('button', { name: /^Next/ });
  await expect(next).toBeEnabled();
  // Two clicks in ONE task share a render, as a real double-click can. Two Playwright clicks
  // are separate tasks: React re-renders between them and the second meets a disabled button.
  await next.evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await questionIdAfter(page, first);
  await expect(next).toBeDisabled();

  // Back lands on the first question only if the double-click advanced exactly one.
  await page.getByRole('button', { name: /^Back/ }).click();
  await expect(question(page)).toHaveAttribute('data-question-id', String(first));
});

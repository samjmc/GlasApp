/**
 * The anonymous quiz end to end: region, every question, results, party matches. Plus the
 * double-click on Next that used to skip a question, and the adaptive follow-ups.
 *
 * Expectations come from the API and the shared planner (shared/quizPlan.ts), not from
 * hard-coded numbers, so a change to the bank or the party blend cannot break this test while
 * the UI still does what they say.
 */
import { expect, test, type Page } from '@playwright/test';
import { DIMENSION_POLES } from '@shared/ideology';
import { QUIZ_QUESTIONS, type QuizResponse } from '@shared/quiz';
import { answerOrder, planQuiz, responsesFor } from '@shared/quizPlan';
import { E2E_TDS } from './harness';

const SEED = 42;
const BANK = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q]));

/** Per question, the first answer with the highest (side 1) or lowest (side −1) value. */
const strongest = (side: 1 | -1) =>
  new Map(
    QUIZ_QUESTIONS.map((q) => {
      const values = q.answers.map((a) => a.value);
      return [q.id, values.indexOf(side === 1 ? Math.max(...values) : Math.min(...values))];
    }),
  );
/** All-max scores +10 on every dimension, and is decisive everywhere: no follow-ups. */
const MAX = strongest(1);
const MIN = strongest(-1);

const byQuestion = (a: QuizResponse, b: QuizResponse) => a.questionId - b.questionId;

const question = (page: Page) => page.getByTestId('quiz-question');

/** The shown question's id. Waits until it is not `previous`, which skips the exiting container. */
async function questionIdAfter(page: Page, previous: number | null): Promise<number> {
  await expect.poll(async () => Number(await question(page).getAttribute('data-question-id'))).not.toBe(previous ?? 0);
  return Number(await question(page).getAttribute('data-question-id'));
}

async function answer(page: Page, id: number, index = MAX.get(id)!): Promise<void> {
  const button = page.locator(
    `[data-testid="quiz-question"][data-question-id="${id}"] [data-testid="quiz-answer"][data-answer-index="${index}"]`,
  );
  await button.click();
  await expect(button).toHaveAttribute('aria-checked', 'true');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, analytics: false, functional: false }));
  });
});

test('anonymous quiz: answers, scores and party matches agree with the API', async ({ page, request }) => {
  test.setTimeout(120_000);
  const submitted = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/quiz');

  await page.goto('/quiz?seed=42');
  await expect(page).toHaveURL(/\/select-region\?next=/);
  await page.getByRole('button', { name: /Continue with Ireland/ }).click();
  await expect(page).toHaveURL(/\/quiz\?seed=42$/);

  await page.getByRole('button', { name: /Start the quiz/ }).click();
  // All-max is decisive on every dimension, so the quiz is the seed's base and nothing more.
  const plan = planQuiz(SEED, Object.fromEntries(MAX));
  const expected = [...plan.base, ...plan.followUps];
  expect(plan.followUps).toEqual([]);
  const total = Number(await page.getByRole('progressbar', { name: 'Quiz progress' }).getAttribute('aria-valuemax'));
  expect(total).toBe(expected.length);

  const seen: number[] = [];
  for (let i = 0; i < total; i++) {
    const id = await questionIdAfter(page, seen.at(-1) ?? null);
    seen.push(id);
    if (i === 1) await expect(page.getByText(`Question 2 of ${total}`)).toBeVisible();
    await answer(page, id);
    await page.getByRole('button', { name: /^(Next|See my results)/ }).click();
  }
  await expect(page).toHaveURL(/\/quiz\/results/);

  // The seed's questions, in plan order.
  expect(seen).toEqual(expected);

  // The UI sent exactly the planned answers, and the seed.
  const body = (await submitted).postDataJSON() as { answers: QuizResponse[]; seed: number };
  const planned: QuizResponse[] = seen.map((id) => ({ questionId: id, answerIndex: MAX.get(id)! }));
  expect([...body.answers].sort(byQuestion)).toEqual(planned.sort(byQuestion));
  expect(body.seed).toBe(SEED);

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
  const { base } = planQuiz(SEED, {});
  expect(await questionIdAfter(page, first)).toBe(base[1]);
  await expect(page.getByText(`Question 2 of ${base.length}`)).toBeVisible();
  await expect(next).toBeDisabled();

  // Back lands on the first question only if the double-click advanced exactly one.
  await page.getByRole('button', { name: /^Back/ }).click();
  await expect(question(page)).toHaveAttribute('data-question-id', String(first));
});

test('answers that are not clear-cut get follow-ups, and a reload keeps the questions and answer order', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('glas.region', 'IE'));
  const submitted = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/quiz');

  // The first-ranked base question of each dimension at its strongest positive, the rest at their
  // strongest negative: no dimension is clear-cut, so each one that has candidates is followed up.
  const { base } = planQuiz(SEED, {});
  const answers: Record<number, number> = {};
  const started = new Set<string>();
  for (const id of base) {
    const dimension = BANK.get(id)!.dimension;
    answers[id] = started.has(dimension) ? MIN.get(id)! : MAX.get(id)!;
    started.add(dimension);
  }
  const plan = planQuiz(SEED, answers);
  expect(plan.followUps.length).toBeGreaterThan(0);
  for (const id of plan.followUps) answers[id] = MAX.get(id)!;

  await page.goto(`/quiz?seed=${SEED}`);
  await page.getByRole('button', { name: /Start the quiz/ }).click();
  let previous: number | null = null;
  for (const id of base) {
    expect(await questionIdAfter(page, previous)).toBe(id);
    await answer(page, id, answers[id]);
    // Not "See my results": the last base answer has just added the follow-ups.
    await page.getByRole('button', { name: /^Next/ }).click();
    previous = id;
  }

  const note = page.getByTestId('quiz-follow-ups');
  await expect(note).toBeVisible();
  for (const d of plan.followUpDimensions) await expect(note).toContainText(DIMENSION_POLES[d].label);
  await expect(note).toContainText(`ask ${plan.followUps.length} more`);
  const total = base.length + plan.followUps.length;
  await expect(page.getByRole('progressbar', { name: 'Quiz progress' })).toHaveAttribute('aria-valuemax', String(total));
  await page.getByRole('button', { name: /^Continue/ }).click();

  const first = plan.followUps[0]!;
  expect(await questionIdAfter(page, previous)).toBe(first);
  await expect(page.getByText(`Question ${base.length + 1} of ${total}`)).toBeVisible();
  const shownOrder = () =>
    page
      .locator(`[data-testid="quiz-question"][data-question-id="${first}"] [data-testid="quiz-answer"]`)
      .evaluateAll((buttons) => buttons.map((b) => Number(b.getAttribute('data-answer-index'))));
  const before = await shownOrder();
  expect(before).toEqual(answerOrder(SEED, first, BANK.get(first)!.answers.length));

  // A reload, then Continue, comes back to the same question with its answers in the same order.
  await page.reload();
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(question(page)).toHaveAttribute('data-question-id', String(first));
  expect(await shownOrder()).toEqual(before);

  previous = null;
  for (const id of plan.followUps) {
    expect(await questionIdAfter(page, previous)).toBe(id);
    await answer(page, id, answers[id]);
    await page.getByRole('button', { name: /^(Next|See my results)/ }).click();
    previous = id;
  }
  await expect(page).toHaveURL(/\/quiz\/results/);

  // The planned answers in plan order, with the seed; the server verified the plan.
  expect((await submitted).postDataJSON()).toEqual({ answers: responsesFor(plan, answers), seed: SEED });
  const result = await page.evaluate(() => JSON.parse(sessionStorage.getItem('glas.quiz.result') ?? 'null'));
  expect(result.followUpDimensions).toEqual(plan.followUpDimensions);
});

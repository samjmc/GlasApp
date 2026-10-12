/**
 * A signed-in user's unsaved quiz result is saved from the results page. When that save does not
 * happen (they say no to consent, or the save fails) the page used to say "Saving this result to
 * your profile…" for ever. It must say what happened and offer "Save to my profile", which asks
 * for consent again and saves. Sign-in, consent and the save are faked (the e2e server has no
 * Supabase); the anonymous result itself comes from the real POST /api/quiz.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { POLITICAL_CONSENT_VERSION } from '@shared/consent';
import { QUIZ_QUESTIONS, type QuizResult } from '@shared/quiz';
import { planQuiz, responsesFor } from '@shared/quizPlan';

const SEED = 42;
const FIRST_ANSWERS = Object.fromEntries(QUIZ_QUESTIONS.map((q) => [q.id, 0]));

class FakeApi {
  consented: boolean;
  /** Replies to the page's POST /api/quiz still to fail with a 500. */
  failures: number;
  saves = 0;

  constructor(opts: { consented: boolean; failures: number }) {
    this.consented = opts.consented;
    this.failures = opts.failures;
  }

  async install(page: Page, result: QuizResult) {
    const ok = (data: unknown) => ({ json: { success: true, data } });
    await page.route('**/api/profile/me', (route) =>
      route.fulfill(
        ok({
          isAdmin: false,
          user: this.consented
            ? { politicalConsentAt: new Date().toISOString(), politicalConsentVersion: POLITICAL_CONSENT_VERSION }
            : { politicalConsentAt: null, politicalConsentVersion: null },
        }),
      ),
    );
    await page.route('**/api/account/consent/political', (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      this.consented = true;
      return route.fulfill(ok({ version: POLITICAL_CONSENT_VERSION }));
    });
    await page.route('**/api/quiz/me', (route) => route.fulfill(ok([])));
    await page.route('**/api/quiz', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      this.saves += 1;
      if (this.failures > 0) {
        this.failures -= 1;
        return route.fulfill({ status: 500, json: { success: false, error: 'Something went wrong' } });
      }
      // As the server: kept (an id) only with consent.
      return route.fulfill(ok({ ...result, id: this.consented ? 99 : null }));
    });
  }
}

/** Signed in, with an anonymous result from this session waiting to be saved. */
async function open(page: Page, api: FakeApi, result: QuizResult, answers: unknown) {
  await page.addInitScript(
    ([stored, storedAnswers, seed]) => {
      localStorage.setItem('cookie_consent', JSON.stringify({ essential: true }));
      localStorage.setItem('glas.region', 'IE');
      sessionStorage.setItem('glas.quiz.result', JSON.stringify(stored));
      sessionStorage.setItem('glas.quiz.answers', JSON.stringify(storedAnswers));
      sessionStorage.setItem('glas.quiz.resultSeed', JSON.stringify(seed));
      const now = Math.floor(Date.now() / 1000);
      localStorage.setItem(
        'glas-politics-auth',
        JSON.stringify({
          access_token: 'e2e.fake.token',
          refresh_token: 'e2e-refresh',
          token_type: 'bearer',
          expires_in: 86_400,
          expires_at: now + 86_400,
          user: {
            id: 'e2e-user',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'e2e@example.com',
            app_metadata: {},
            user_metadata: {},
            created_at: '2026-01-01T00:00:00Z',
          },
        }),
      );
    },
    [result, answers, SEED] as const,
  );
  await api.install(page, result);
  await page.goto('/quiz/results');
}

async function anonymousResult(request: APIRequestContext) {
  const answers = responsesFor(planQuiz(SEED, FIRST_ANSWERS), FIRST_ANSWERS);
  const scored = await request.post('/api/quiz', { data: { answers, seed: SEED } });
  expect(scored.ok()).toBe(true);
  const result = (await scored.json()).data as QuizResult;
  expect(result.id).toBeNull();
  return { result, answers };
}

const saving = (page: Page) => page.getByText('Saving this result to your profile');
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save to my profile' });
const savedText = (page: Page) => page.getByText('This result is saved to your profile.');

test('saying no to consent says "Not saved", and Save to my profile asks again and saves', async ({ page, request }) => {
  const { result, answers } = await anonymousResult(request);
  const api = new FakeApi({ consented: false, failures: 0 });
  await open(page, api, result, answers);

  const dialog = page.getByRole('dialog', { name: 'Can we keep your political opinions?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Not now' }).click();

  await expect(page.getByText(/^Not saved\. We keep a result only if/)).toBeVisible();
  await expect(saving(page)).toHaveCount(0);
  expect(api.saves).toBe(0);

  await saveButton(page).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'I agree' }).click();

  await expect(savedText(page)).toBeVisible();
  await expect(saveButton(page)).toHaveCount(0);
  expect(api.saves).toBe(1);
});

test('a failed save says so, and Save to my profile tries again', async ({ page, request }) => {
  const { result, answers } = await anonymousResult(request);
  const api = new FakeApi({ consented: true, failures: 1 });
  await open(page, api, result, answers);

  await expect(page.getByText("We couldn't save this result to your profile.")).toBeVisible();
  await expect(saving(page)).toHaveCount(0);
  expect(api.saves).toBe(1);

  await saveButton(page).click();
  await expect(savedText(page)).toBeVisible();
  expect(api.saves).toBe(2);
});

/**
 * "Download my data" on the profile page, end to end in a browser: the button asks the server for the
 * export, and the person gets it as a JSON file. Sign-in is faked and so is the API (the e2e server has
 * no Supabase, so it cannot verify a token); what is under test is the page and the file it saves. What
 * the export holds, and that it never holds another user's rows, is covered against Postgres by
 * server/account/exportUserData.integration.test.ts.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const EXPORT = {
  format: 1,
  exportedAt: '2026-10-10T12:00:00.000Z',
  account: { id: 'e2e-user', email: 'e2e@example.com', firstName: 'Eva' },
  quizResults: [{ id: 1, ideology: 'Centrist' }],
  votes: [{ questionId: 7, question: 'Should the State build homes?', answer: 'Build them' }],
};

async function signInOnProfile(page: Page, exportReply: { status: number; json: unknown }) {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, analytics: false, functional: false }));
    localStorage.setItem('glas.region', 'IE');
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
  });
  const ok = (data: unknown) => ({ json: { success: true, data } });
  await page.route('**/api/profile/me', (route) => route.fulfill(ok({ isAdmin: false, user: { politicalConsentAt: null, politicalConsentVersion: null } })));
  await page.route('**/api/quiz/me', (route) => route.fulfill(ok([])));
  await page.route('**/api/daily-session', (route) => route.fulfill(ok({ status: 'completed', sessionId: 1, sessionDate: '2026-10-10', voteCount: 0, streakCount: 0, items: [] })));
  await page.route('**/api/account/export', (route) => route.fulfill(exportReply));
  await page.goto('/profile');
}

test('Download my data saves the export as a JSON file, and says so', async ({ page }) => {
  await signInOnProfile(page, { status: 200, json: { success: true, data: EXPORT } });

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download my data' }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toMatch(/^glas-politics-data-\d{4}-\d{2}-\d{2}\.json$/);
  // The file is the export itself, not the { success, data } envelope around it.
  expect(JSON.parse(fs.readFileSync((await download.path())!, 'utf8'))).toEqual(EXPORT);
  await expect(page.getByText('Your data is ready').first()).toBeVisible();
});

test('a failed export says so and saves no file', async ({ page }) => {
  await signInOnProfile(page, { status: 500, json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not prepare your data. Please try again.' } } });

  let downloaded = false;
  page.on('download', () => {
    downloaded = true;
  });
  await page.getByRole('button', { name: 'Download my data' }).click();

  await expect(page.getByText('Could not prepare your data').first()).toBeVisible();
  expect(downloaded).toBe(false);
  // The button comes back, so they can try again.
  await expect(page.getByRole('button', { name: 'Download my data' })).toBeEnabled();
});

/**
 * The cookie notice is a plain notice, not a choice: the app stores only what it needs to work and
 * has no analytics, so there are no switches and nothing optional is written. It shows once.
 */
import { expect, test } from '@playwright/test';

test('the cookie notice has one OK button, writes no optional cookies, and shows once', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('glas.region', 'IE');
  });

  await page.goto('/privacy-policy');
  const notice = page.getByRole('region', { name: 'Cookie notice' });
  await expect(notice).toBeVisible();
  // No choice to make: no switches and none of the old buttons.
  await expect(notice.getByRole('switch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Essential only|Accept all|Choose which cookies/ })).toHaveCount(0);

  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(notice).toBeHidden();

  expect(await page.evaluate(() => localStorage.getItem('cookie_consent'))).not.toBeNull();
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/cookie_analytics|cookie_functional/);

  // Once is enough: the notice is not shown on the next visit (it appears 1 s after load, so wait past that).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Privacy Policy' }).first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(notice).toHaveCount(0);
});

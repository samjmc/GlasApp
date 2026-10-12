/**
 * Moving between pages must not restart the app. The global ErrorBoundary used to be keyed on the
 * location, which remounted AuthProvider on every navigation and put the full-screen loader back up
 * until the session was read again. A page that is not crashed has to swap in place.
 */
import { expect, test } from '@playwright/test';

test('navigating between two pages does not show the full-screen loader again', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true }));
    localStorage.setItem('glas.region', 'IE');
    // Counts every time the loader (role=status, aria-label=Loading) is added to the page.
    (window as unknown as { __loaderShown: number }).__loaderShown = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element && (node.matches('[role="status"][aria-label="Loading"]') || node.querySelector('[role="status"][aria-label="Loading"]'))) {
            (window as unknown as { __loaderShown: number }).__loaderShown += 1;
          }
        });
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto('/privacy-policy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy' }).first()).toBeVisible();
  await expect(page.locator('[role="status"][aria-label="Loading"]')).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { __loaderShown: number }).__loaderShown = 0;
  });

  // wouter listens for pushState, so this is a client-side navigation with no page load.
  await page.evaluate(() => history.pushState(null, '', '/terms-of-service'));
  await expect(page.getByRole('heading', { name: 'Terms of Service' }).first()).toBeVisible();

  expect(await page.evaluate(() => (window as unknown as { __loaderShown: number }).__loaderShown)).toBe(0);
});

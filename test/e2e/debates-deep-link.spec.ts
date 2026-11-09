/**
 * /debates?tab=bills&bill=<id> opens the Bills tab. Once the user picks another tab, the query must go,
 * or a reload (or a copied link) lands back on Bills instead of the tab that was in view.
 */
import { expect, test } from '@playwright/test';

test('leaving a deep-linked tab drops ?tab and ?bill from the address', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true }));
    localStorage.setItem('glas.region', 'IE');
  });

  await page.goto('/debates?tab=bills&bill=e2e-none');
  await expect(page.getByRole('tab', { name: 'Bills' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: 'Divisions' }).click();
  await expect(page.getByRole('tab', { name: 'Divisions' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\/debates$/);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Divisions' })).toHaveAttribute('aria-selected', 'true');
});

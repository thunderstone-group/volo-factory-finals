import { test, expect } from '@playwright/test';

test('REQ-2: reset a changed count to zero', async ({ page }) => {
  await page.goto('/');

  const count = page.getByTestId('count');
  await page.getByRole('button', { name: 'Increment' }).click();
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(count).toHaveText('2');

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(count).toHaveText('0');
});

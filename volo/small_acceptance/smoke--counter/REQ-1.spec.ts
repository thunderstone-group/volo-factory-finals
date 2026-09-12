import { test, expect } from '@playwright/test';

test('REQ-1: increment and decrement the counter', async ({ page }) => {
  await page.goto('/');

  const count = page.getByTestId('count');
  const increment = page.getByRole('button', { name: 'Increment' });
  const decrement = page.getByRole('button', { name: 'Decrement' });

  await expect(count).toHaveText('0');
  await expect(increment).toBeVisible();
  await expect(decrement).toBeVisible();

  await increment.click();
  await increment.click();
  await expect(count).toHaveText('2');

  await decrement.click();
  await decrement.click();
  await decrement.click();
  await expect(count).toHaveText('-1');
});

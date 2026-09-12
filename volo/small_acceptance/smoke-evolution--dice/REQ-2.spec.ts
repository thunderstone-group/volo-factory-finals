import { test, expect } from '@playwright/test';

test('REQ-2: count completed rolls', async ({ page }) => {
  await page.goto('/');

  const roll = page.getByRole('button', { name: 'Roll' });
  const rollCount = page.getByTestId('roll-count');

  await expect(rollCount).toHaveText('0');
  await roll.click();
  await expect(rollCount).toHaveText('1');
  await roll.click();
  await expect(rollCount).toHaveText('2');
  await expect(page.getByTestId('dice-value')).toHaveText(/^[1-6]$/);
});

import { test, expect } from '@playwright/test';

test('REQ-1: roll and display a six-sided dice value', async ({ page }) => {
  await page.goto('/');

  const roll = page.getByRole('button', { name: 'Roll' });
  const diceValue = page.getByTestId('dice-value');

  await expect(roll).toBeVisible();
  await roll.click();
  await expect(diceValue).toHaveText(/^[1-6]$/);
});

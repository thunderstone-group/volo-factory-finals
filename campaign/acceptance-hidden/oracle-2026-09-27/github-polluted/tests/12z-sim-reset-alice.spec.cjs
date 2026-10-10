// SIMULATION ONLY (not part of the oracle): mimic a hidden recovery scenario that resets the seed alice-dev.
const { test, expect } = require('@playwright/test');
const field = (page, name) => page.getByRole('textbox', { name, exact: true });
test('SIM: reset alice-dev password through recovery', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await field(page, 'Email').fill('alice.dev@example.test');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await field(page, 'Verification code').fill('123456');
  await field(page, 'New password').fill('Replacement-password-456!');
  await field(page, 'Confirm password').fill('Replacement-password-456!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated')).toBeVisible();
});

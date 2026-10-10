import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-1-1: Register a New GitHub Account - Evolution Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts at the application home page in a fresh unauthenticated browser session and opens the account-access page. The visitor opens the registration page through the visible “Sign in” and “Create an account” links. The registration page displays visibly labeled Username, Email, Password, and Confirm password fields, a checkbox named “Agree to the terms”, and a button named “Create account”.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await visible(named(page.getByRole('main'), 'link', 'Create an account')); await named(page.getByRole('main'), 'link', 'Create an account').click();
  for (const name of ['Username', 'Email', 'Password', 'Confirm password']) await visible(field(page, name));
  await visible(named(page, 'checkbox', 'Agree to the terms'));
  await expect(named(page, 'checkbox', 'Agree to the terms')).not.toBeChecked();
  await visible(named(page, 'button', 'Create account'));
  // WHEN: The visitor enters the invalid uppercase username `EvoUpper01` in Username, `evo.register.s2@evolution.test` in Email, `Evo-Password-987!` in Password and Confirm password, checks “Agree to the terms”, and clicks “Create account”.
  await fill(page, 'Username', "EvoUpper01"); await fill(page, 'Email', "evo.register.s2@evolution.test");
  await fill(page, 'Password', 'Evo-Password-987!'); await fill(page, 'Confirm password', 'Evo-Password-987!');
  await expect(field(page, 'Password')).toHaveAttribute('type', 'password');
  await expect(field(page, 'Confirm password')).toHaveAttribute('type', 'password');
  await checked(page, 'Agree to the terms', true); await button(page, 'Create account');
  // THEN: The registration page remains open and displays “Username format is invalid”. The Username field retains the value `EvoUpper01`; no account is created.
  await text(page, "Username format is invalid"); await expect(field(page, 'Username')).toHaveValue("EvoUpper01");
  // THEN: The Email, Password, Confirm password, and terms controls remain available for correction, and the rejected submission does not redirect to the sign-in page.
  for (const name of ['Username','Email','Password','Confirm password']) await visible(field(page, name));
  await expect(field(page, 'Password')).toHaveValue(''); await expect(field(page, 'Confirm password')).toHaveValue('');
  await visible(named(page, 'checkbox', 'Agree to the terms')); await visible(named(page, 'button', 'Create account'));
  await expect(named(page, 'button', 'Sign in')).toHaveCount(0);
});

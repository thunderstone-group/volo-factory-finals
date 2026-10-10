import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-1-1: Register a New GitHub Account - Evolution Scenario 1", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts at the application home page in a fresh unauthenticated browser session and opens the account-access page. The visitor clicks the visible link “Sign in” and then the visible link “Create an account”. The registration page displays visibly labeled Username, Email, Password, and Confirm password fields, a checkbox named “Agree to the terms”, and a button named “Create account”. The username `evo_user_01` and email `evo.register.s1@evolution.test` are not registered.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await visible(named(page.getByRole('main'), 'link', 'Create an account')); await named(page.getByRole('main'), 'link', 'Create an account').click();
  for (const name of ['Username', 'Email', 'Password', 'Confirm password']) await visible(field(page, name));
  await visible(named(page, 'checkbox', 'Agree to the terms'));
  await expect(named(page, 'checkbox', 'Agree to the terms')).not.toBeChecked();
  await visible(named(page, 'button', 'Create account'));
  // WHEN: The visitor enters `evo_user_01` in Username, `evo.register.s1@evolution.test` in Email, `Evo-Password-987!` in Password and Confirm password, checks “Agree to the terms”, and clicks “Create account”.
  await fill(page, 'Username', "evo_user_01"); await fill(page, 'Email', "evo.register.s1@evolution.test");
  await fill(page, 'Password', 'Evo-Password-987!'); await fill(page, 'Confirm password', 'Evo-Password-987!');
  await expect(field(page, 'Password')).toHaveAttribute('type', 'password');
  await expect(field(page, 'Confirm password')).toHaveAttribute('type', 'password');
  await checked(page, 'Agree to the terms', true); await button(page, 'Create account');
  // THEN: The system opens the sign-in page and visibly displays the labeled “Username or email” and “Password” fields and the “Sign in” button. The visitor enters `evo.register.s1@evolution.test` in “Username or email”, enters `Evo-Password-987!` in “Password”, and clicks “Sign in”. The workspace visibly displays the username `evo_user_01`.
  await visible(field(page, 'Username or email')); await visible(field(page, 'Password'));
  await fill(page, 'Username or email', 'evo.register.s1@evolution.test'); await fill(page, 'Password', 'Evo-Password-987!');
  await button(page, 'Sign in'); await text(page, 'evo_user_01');
  // THEN: After the visitor reloads the page, the workspace still visibly displays the username `evo_user_01`.
  await page.reload(); await text(page, 'evo_user_01');
});

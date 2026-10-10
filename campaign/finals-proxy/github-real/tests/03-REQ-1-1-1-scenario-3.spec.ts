import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-1-1: Register a New GitHub Account - Evolution Scenario 3", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts at the application home page in a fresh unauthenticated browser session and opens the account-access page. The visitor opens the registration page through the visible “Sign in” and “Create an account” links. The registration page displays visibly labeled Username, Email, Password, and Confirm password fields, a checkbox named “Agree to the terms”, and a button named “Create account”. The system has pre-provisioned the verified and available account `evo-register-existing` with email `evo.register.existing@evolution.test` and password `Evo-Password-987!`; `evo.register.s3@evolution.test` is unused.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await visible(named(page.getByRole('main'), 'link', 'Create an account')); await named(page.getByRole('main'), 'link', 'Create an account').click();
  for (const name of ['Username', 'Email', 'Password', 'Confirm password']) await visible(field(page, name));
  await visible(named(page, 'checkbox', 'Agree to the terms'));
  await expect(named(page, 'checkbox', 'Agree to the terms')).not.toBeChecked();
  await visible(named(page, 'button', 'Create account'));
  // WHEN: The visitor enters `evo-register-existing` in Username, the unused email `evo.register.s3@evolution.test` in Email, `Evo-Password-987!` in Password and Confirm password, checks “Agree to the terms”, and clicks “Create account”.
  await fill(page, 'Username', "evo-register-existing"); await fill(page, 'Email', "evo.register.s3@evolution.test");
  await fill(page, 'Password', 'Evo-Password-987!'); await fill(page, 'Confirm password', 'Evo-Password-987!');
  await expect(field(page, 'Password')).toHaveAttribute('type', 'password');
  await expect(field(page, 'Confirm password')).toHaveAttribute('type', 'password');
  await checked(page, 'Agree to the terms', true); await button(page, 'Create account');
  // THEN: The registration page remains open and displays “Username already exists”. The Username and Email fields retain their attempted values; no second account is created.
  await text(page, "Username already exists"); await expect(field(page, 'Username')).toHaveValue("evo-register-existing"); await expect(field(page, 'Email')).toHaveValue("evo.register.s3@evolution.test");
  // THEN: The valid Username, Password, Confirm password, and terms controls remain available for correction, and the rejected submission does not redirect to the sign-in page.
  for (const name of ['Username','Email','Password','Confirm password']) await visible(field(page, name));
  await expect(field(page, 'Password')).toHaveValue(''); await expect(field(page, 'Confirm password')).toHaveValue('');
  await visible(named(page, 'checkbox', 'Agree to the terms')); await visible(named(page, 'button', 'Create account'));
  await expect(named(page, 'button', 'Sign in')).toHaveCount(0);
});

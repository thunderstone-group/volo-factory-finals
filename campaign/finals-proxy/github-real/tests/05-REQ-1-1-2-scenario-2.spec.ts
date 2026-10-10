import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-1-2: Sign In with an Existing Account - Evolution Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor starts in a fresh unauthenticated browser session. The system has pre-provisioned a verified and available account with username `evo-login-case`, email `evo.login.case@evolution.test`, and password `Evo-Password-987!`.

  // WHEN: The visitor opens the application home page, clicks the visible link named “Sign in”, enters `EVO.LOGIN.CASE@EVOLUTION.TEST` in the visibly labeled “Username or email” field, enters `Evo-Password-987!` in the visibly labeled “Password” field, and clicks the button named “Sign in”.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "EVO.LOGIN.CASE@EVOLUTION.TEST"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  // THEN: The system enters the workspace and visibly displays the username `evo-login-case`.
  await text(page, 'evo-login-case');
});

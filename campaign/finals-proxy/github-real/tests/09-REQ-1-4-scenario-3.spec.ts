import { test, expect } from '@playwright/test';
import { clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-4: Manage Active Browser Sessions - Scenario 3", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions `evo-session-owner-s3` and two active browser sessions using the verified credentials `evo.session.owner.s3@evolution.test` and `Evo-Password-987!`.
  const otherContext = await browser.newContext({baseURL, storageState: {cookies:[], origins:[]}});
  const other = await otherContext.newPage();
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-session-owner-s3"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await other.goto('/');
  await visible(named(other.getByRole('main'), 'link', 'Sign in')); await named(other.getByRole('main'), 'link', 'Sign in').click();
  await fill(other, 'Username or email', "evo-session-owner-s3"); await fill(other, 'Password', "Evo-Password-987!");
  await button(other, 'Sign in');
  await text(other, 'evo-session-owner-s3');
  // WHEN: The visitor revokes one session from the other active session and then reloads the revoked browser.
  await button(page, 'Account menu'); await clickEvolutionTarget(page, 'Settings'); await clickEvolutionTarget(page, 'Active sessions');
  await page.getByRole('button', {name:/revoke session/i}).first().click();
  await other.reload();
  // THEN: The revoked browser is redirected to the sign-in page and cannot access the protected workspace, while the other browser still displays `evo-session-owner-s3`.
  await expect(other.getByRole('main').getByRole('link', {name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByText('evo-session-owner-s3', {exact:true}).first()).toBeVisible(); await otherContext.close();
});

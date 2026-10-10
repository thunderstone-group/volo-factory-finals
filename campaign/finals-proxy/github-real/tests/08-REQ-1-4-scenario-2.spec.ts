import { test, expect } from '@playwright/test';
import { clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-4: Manage Active Browser Sessions - Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions `evo-session-owner-s2` with email `evo.session.owner.s2@evolution.test` and password `Evo-Password-987!`. Two browser sessions for that account are active.
  const otherContext = await browser.newContext({baseURL, storageState: {cookies:[], origins:[]}});
  const other = await otherContext.newPage();
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-session-owner-s2"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await other.goto('/');
  await visible(named(other.getByRole('main'), 'link', 'Sign in')); await named(other.getByRole('main'), 'link', 'Sign in').click();
  await fill(other, 'Username or email', "evo-session-owner-s2"); await fill(other, 'Password', "Evo-Password-987!");
  await button(other, 'Sign in');
  await text(other, 'evo-session-owner-s2');
  // WHEN: The visitor opens “Active sessions” in one browser and clicks “Revoke session” for the other browser session.
  await button(page, 'Account menu'); await clickEvolutionTarget(page, 'Settings'); await clickEvolutionTarget(page, 'Active sessions');
  await page.getByRole('button', {name:/revoke session/i}).first().click();
  // THEN: The page displays “Session revoked” or an inactive marker for the revoked row, the current session remains active, and the sessions page shows the updated state after reload.
  await expect(page.getByText(/revoked|inactive/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name:'Active sessions',exact:true})).toBeVisible();
  await expect(page.getByText(/revoked|inactive/i)).toBeVisible();
  await otherContext.close();
});

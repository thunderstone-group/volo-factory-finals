import { test, expect } from '@playwright/test';
import { clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-4: Manage Active Browser Sessions - Scenario 1", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions the verified account `evo-session-owner` with email `evo.session.owner@evolution.test` and password `Evo-Password-987!`. The visitor starts in a fresh browser session and can sign in.

  // WHEN: The visitor signs in as `evo-session-owner`, opens “Account menu”, clicks “Settings”, and opens “Active sessions”.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-session-owner"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await button(page, 'Account menu'); await clickEvolutionTarget(page, 'Settings'); await clickEvolutionTarget(page, 'Active sessions');
  // THEN: The page displays the heading “Active sessions”, a row visibly marked as the current session, its device label and “Last active” information, and no session secret or token.
  await visible(named(page, 'heading', 'Active sessions'));
  const current = page.getByRole('row').or(page.getByRole('listitem')).filter({hasText: /current (?:browser )?session/i});
  await visible(current); await expect(current).toContainText('Last active');
  const currentText = await current.innerText();
  expect(currentText.replace(/current (?:browser )?session|last active|[\d\s:./-]/gi, '').trim().length).toBeGreaterThan(0);
  await expect(current.getByRole('button', {name:'Revoke session', exact:true})).toHaveCount(0);
  await expect(page.getByText(/(?:session[_ -]?(?:secret|token)|token)\s*[:=]\s*\S+/i)).toHaveCount(0);
});

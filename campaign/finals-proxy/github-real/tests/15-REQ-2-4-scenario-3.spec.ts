import { test, expect } from '@playwright/test';
import { clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-2-4: View Organization Audit Log - Scenario 3", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions organization `evo-audit-org` with ordinary Member account `evo-audit-viewer`, email `evo.audit.viewer@evolution.test`, password `Evo-Password-987!`, and the Owner audit events.

  // WHEN: The Member signs in and opens `evo-audit-org`.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-audit-viewer"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await button(page, 'Account menu'); await clickEvolutionTarget(page, 'Your organizations'); await clickEvolutionTarget(page, 'evo-audit-org');
  // THEN: The organization overview does not expose an actionable “Audit log” link.
  await unavailable(named(page, 'link', 'Audit log').or(named(page, 'button', 'Audit log')));
});

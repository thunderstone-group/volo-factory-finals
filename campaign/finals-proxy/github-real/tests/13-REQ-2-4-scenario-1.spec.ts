import { test, expect } from '@playwright/test';
import { clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-2-4: View Organization Audit Log - Scenario 1", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions organization `evo-audit-org`, Owner account `evo-audit-owner` with email `evo.audit.owner@evolution.test` and password `Evo-Password-987!`, and audit events containing an actor, action, target, and time.

  // WHEN: The Owner signs in, opens `evo-audit-org`, and clicks “Audit log”.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-audit-owner"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await clickEvolutionTarget(page, 'evo-audit-org'); await clickEvolutionTarget(page, 'Audit log');
  // THEN: The page displays the heading “Audit log” and event rows showing an actor, action type, target, and timestamp.
  await visible(named(page, 'heading', 'Audit log'));
  const table = page.getByRole('table'); await visible(table);
  for (const header of ['Actor','Action','Target','Timestamp']) await visible(named(table, 'columnheader', header));
  const rows = table.getByRole('row').filter({has:page.getByRole('cell')}); await expect(rows).not.toHaveCount(0);
  for (const row of await rows.all()) { const cells = row.getByRole('cell'); await expect(cells).toHaveCount(4); for (const c of await cells.all()) await expect(c).not.toHaveText(''); }
});

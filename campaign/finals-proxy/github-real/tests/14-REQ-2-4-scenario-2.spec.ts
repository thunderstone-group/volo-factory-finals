import { test, expect } from '@playwright/test';
import { clickEvolutionTarget } from './evolution-navigation';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-2-4: View Organization Audit Log - Scenario 2", async ({ page, browser, baseURL }) => {
  // GIVEN: The system pre-provisions `evo-audit-org` for Owner `evo-audit-owner` and records at least one “Member added” event and one “Repository created” event.

  // WHEN: The Owner opens “Audit log”, selects “Member added” in the “Filter action” combobox, and reloads the page.
  await page.goto('/');
  await visible(named(page.getByRole('main'), 'link', 'Sign in')); await named(page.getByRole('main'), 'link', 'Sign in').click();
  await fill(page, 'Username or email', "evo-audit-owner"); await fill(page, 'Password', "Evo-Password-987!");
  await button(page, 'Sign in');
  await clickEvolutionTarget(page, 'evo-audit-org'); await clickEvolutionTarget(page, 'Audit log'); await choose(page, 'Filter action', 'Member added'); await page.reload();
  // THEN: Only matching “Member added” rows remain visible after reload; clearing the filter restores the other seeded event.
  const table = page.getByRole('table'); await visible(table);
  for (const header of ['Actor','Action','Target','Timestamp']) await visible(named(table, 'columnheader', header));
  const rows = table.getByRole('row').filter({has:page.getByRole('cell')}); await expect(rows).not.toHaveCount(0);
  for (const row of await rows.all()) { const cells = row.getByRole('cell'); await expect(cells).toHaveCount(4); for (const c of await cells.all()) await expect(c).not.toHaveText(''); }
  await selected(page, 'Filter action', 'Member added');
  for (const row of await rows.all()) await expect(row.getByRole('cell').nth(1)).toHaveText('Member added');
  await choose(page, 'Filter action', 'All actions');
  await visible(named(table, 'cell', 'Repository created'));
});

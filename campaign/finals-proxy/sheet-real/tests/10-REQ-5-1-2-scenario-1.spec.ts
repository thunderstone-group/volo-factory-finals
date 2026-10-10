import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-1-2 - save a two-condition filter view", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M04-FILTER-SAVE` with active worksheet `Workload`, range D3:F7 headed `Workstream/Phase/Load`, and rows `Atlas/Queued/17`, `Atlas/Active/31`, `Beacon/Queued/22`, and `Cirrus/Queued/9`.

  // WHEN: The visitor opens `EVO-M04-FILTER-SAVE`, creates a filter for D3:F7, applies `Text contains` value `Atlas` to "Filter Workstream", applies `Greater than` value `20` to "Filter Load", opens "Save filter view", enters `Atlas active load` in "Filter view name", and clicks "Save view".
  await page.goto('/'); await activate(page, "EVO-M04-FILTER-SAVE");
  // Visible official applyCondition entry: sheet-real-F01, lines 7-10.
  await button(page, 'Create filter');
  let filter = named(page, 'dialog', 'Filter'); await visible(filter);
  await fill(filter, 'Range', 'D3:F7'); await fill(filter, 'Column', 'D');
  await choose(filter, 'Condition', 'Text contains'); await fill(filter, 'Value', 'Atlas'); await button(filter, 'Apply');
  await button(page, 'Create filter');
  filter = named(page, 'dialog', 'Filter'); await visible(filter);
  await fill(filter, 'Range', 'D3:F7'); await fill(filter, 'Column', 'F');
  await choose(filter, 'Condition', 'Greater than'); await fill(filter, 'Value', '20'); await button(filter, 'Apply');
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Save filter view",exact:true}).click();
  await fill(page, 'Filter view name', 'Atlas active load'); await button(page, 'Save view');
  // THEN: Only row 5 containing `Atlas/Active/31` is visible, and after refresh "Filter views" contains exactly `Atlas active load` with the same visible row.
  for (const r of [4,6,7]) await expect(named(page, 'gridcell', 'D'+r)).toBeHidden();
  await visible(named(page, 'gridcell', "D5")); await expect(named(page, 'gridcell', "D5")).toHaveText("Atlas");
  await visible(named(page, 'gridcell', "E5")); await expect(named(page, 'gridcell', "E5")).toHaveText("Active");
  await visible(named(page, 'gridcell', "F5")); await expect(named(page, 'gridcell', "F5")).toHaveText("31");
  await page.reload();
  await command(page, "Data"); await visible(named(page, 'menuitem', 'Filter views')); await named(page, 'menuitem', 'Filter views').click();
  await visible(named(page,'button','Atlas active load').or(named(page,'option','Atlas active load')));
  for (const r of [4,6,7]) await expect(named(page, 'gridcell', 'D'+r)).toBeHidden();
  await visible(named(page, 'gridcell', "D5")); await expect(named(page, 'gridcell', "D5")).toHaveText("Atlas");
  await visible(named(page, 'gridcell', "E5")); await expect(named(page, 'gridcell', "E5")).toHaveText("Active");
  await visible(named(page, 'gridcell', "F5")); await expect(named(page, 'gridcell', "F5")).toHaveText("31");
});

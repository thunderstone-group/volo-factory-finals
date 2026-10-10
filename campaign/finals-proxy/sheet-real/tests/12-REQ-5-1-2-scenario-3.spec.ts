import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-1-2 - reject and delete a saved filter view", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M04-FILTER-DELETE` with active worksheet `Workload`, range D3:F7 headed `Workstream/Phase/Load`, and saved filter view `Queued lanes`.

  // WHEN: The visitor opens `EVO-M04-FILTER-DELETE`, creates a filter for D3:F7, opens "Save filter view", enters ` queued lanes ` in "Filter view name", clicks "Save view", then opens "Filter views", chooses `Queued lanes`, and clicks "Delete filter view".
  await page.goto('/'); await activate(page, "EVO-M04-FILTER-DELETE");
  await rectangle(page, 'D3', 'F7');
  await command(page, "Data"); await command(page, "Create filter");
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Save filter view",exact:true}).click();
  await fill(page, 'Filter view name', ' queued lanes '); await button(page, 'Save view');
  // The published THEN refers to this intermediate rejected save, before the deletion.
  await expect(page.getByRole('alert')).toContainText('Filter view name already exists');
  const saveDialog = page.getByRole('dialog').filter({ has: page.getByLabel('Filter view name', { exact: true }) });
  await button(saveDialog, 'Close');
  await command(page, "Data"); await visible(named(page, 'menuitem', 'Filter views')); await named(page, 'menuitem', 'Filter views').click();
  await page.getByRole('dialog', {name:'Filter views',exact:true}).getByRole('button', {name:'Queued lanes',exact:true}).click(); await button(page, 'Delete filter view');
  // THEN: The exact message "Filter view name already exists" is visible after the first save attempt; after deletion "Filter views" no longer contains `Queued lanes`, all source rows remain visible, and the deletion persists after refresh.
  await expect(named(page,'button','Queued lanes').or(named(page,'option','Queued lanes'))).toHaveCount(0);
  for (const [r,values] of [[4,['Atlas','Queued','17']],[5,['Atlas','Active','31']],[6,['Beacon','Queued','22']],[7,['Cirrus','Queued','9']]] as const) {
    for (const [i,c] of ['D','E','F'].entries()) { await visible(named(page,'gridcell',c+r)); await expect(named(page,'gridcell',c+r)).toHaveText(values[i]); }
  }
  await page.reload();
  await command(page, "Data"); await visible(named(page, 'menuitem', 'Filter views')); await named(page, 'menuitem', 'Filter views').click();
  await expect(named(page,'button','Queued lanes').or(named(page,'option','Queued lanes'))).toHaveCount(0);
  for (const [r,values] of [[4,['Atlas','Queued','17']],[5,['Atlas','Active','31']],[6,['Beacon','Queued','22']],[7,['Cirrus','Queued','9']]] as const) {
    for (const [i,c] of ['D','E','F'].entries()) { await visible(named(page,'gridcell',c+r)); await expect(named(page,'gridcell',c+r)).toHaveText(values[i]); }
  }
});

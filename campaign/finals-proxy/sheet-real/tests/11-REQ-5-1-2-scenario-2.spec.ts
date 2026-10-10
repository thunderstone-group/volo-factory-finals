import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-1-2 - apply a persisted saved filter view", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M04-FILTER-APPLY` with active worksheet `Workload`, range D3:F7 headed `Workstream/Phase/Load`, and saved filter view `Queued lanes` selecting Phase values `Queued`.

  // WHEN: The visitor opens `EVO-M04-FILTER-APPLY`, opens "Filter views" in the "Data" menu, and clicks `Queued lanes`.
  await page.goto('/'); await activate(page, "EVO-M04-FILTER-APPLY");
  await command(page, "Data"); await visible(named(page, 'menuitem', 'Filter views')); await named(page, 'menuitem', 'Filter views').click();
  await page.getByRole('dialog', {name:'Filter views',exact:true}).getByRole('button', {name:'Queued lanes',exact:true}).click();
  // THEN: Rows containing `Atlas/Queued/17`, `Beacon/Queued/22`, and `Cirrus/Queued/9` are visible while the `Atlas/Active/31` row is hidden; the same state remains after refresh.
  for (const [r,values] of [[4,['Atlas','Queued','17']],[6,['Beacon','Queued','22']],[7,['Cirrus','Queued','9']]] as const) {
    for (const [i,c] of ['D','E','F'].entries()) { await visible(named(page,'gridcell',c+r)); await expect(named(page,'gridcell',c+r)).toHaveText(values[i]); }
  }
  await expect(named(page,'gridcell','D5')).toBeHidden();
  await page.reload();
  for (const [r,values] of [[4,['Atlas','Queued','17']],[6,['Beacon','Queued','22']],[7,['Cirrus','Queued','9']]] as const) {
    for (const [i,c] of ['D','E','F'].entries()) { await visible(named(page,'gridcell',c+r)); await expect(named(page,'gridcell',c+r)).toHaveText(values[i]); }
  }
  await expect(named(page,'gridcell','D5')).toBeHidden();
});

import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-7-1-1 - create a named range and use it in a formula", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N03-NAMED-CREATE` with active worksheet `ForecastModel`, where J3:J5 contain `18`, `24`, and `31`, and L3 is empty.

  // WHEN: The visitor opens `EVO-N03-NAMED-CREATE`, opens "Data", clicks "Named ranges", clicks "Add named range", enters `CapacityPlan` in "Name", enters `ForecastModel!J3:J5` in "Range", clicks "Save", selects L3, enters `=SUM(CapacityPlan)` in "Formula bar", and presses Enter.
  await page.goto('/'); await activate(page, "EVO-N03-NAMED-CREATE");
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Named ranges",exact:true}).click();
  const dialog=named(page,'dialog','Named ranges'); await visible(dialog);
  await button(page,'Add named range'); await fill(page,'Name','CapacityPlan'); await fill(page,'Range','ForecastModel!J3:J5'); await button(page,'Save');
  // F06:22 ends an unseen conditional; retain reopening when Save closes the panel.
  if (!await dialog.isVisible()) { await command(page, 'Data'); await page.getByRole('menuitem', {name:"Named ranges",exact:true}).click(); }
  await expect(page.getByRole('dialog', { name: 'Named ranges', exact: true })).toContainText('CapacityPlan');
  await button(page.getByRole('dialog', { name: 'Named ranges', exact: true }), 'Close');
  await visible(named(page, "gridcell", "L3")); await named(page, "gridcell", "L3").click();
  await fill(page, 'Formula bar', "=SUM(CapacityPlan)"); await field(page, 'Formula bar').press('Enter');
  // THEN: The "Named ranges" dialog lists `CapacityPlan`, L3 displays `73`, and after refresh the formula bar for L3 contains `=SUM(CapacityPlan)`.
  await visible(named(page, 'gridcell', "L3")); await expect(named(page, 'gridcell', "L3")).toHaveText("73");
  await page.reload();
  await visible(named(page, "gridcell", "L3")); await named(page, "gridcell", "L3").click();
  await expect(field(page,'Formula bar')).toHaveValue('=SUM(CapacityPlan)');
});

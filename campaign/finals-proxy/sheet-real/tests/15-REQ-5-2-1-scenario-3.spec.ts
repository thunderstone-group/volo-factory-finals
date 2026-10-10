import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-2-1 - persist an updated custom error message", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M05-VALIDATION-EDIT` with active worksheet `Thresholds`, cell L4 value `42`, and a number-range validation rule of 25 to 75 with error message `Capacity must be from 25 to 75`.

  // WHEN: The visitor opens `EVO-M05-VALIDATION-EDIT`, opens "Data validation" for L4, replaces "Error message" with `Allocate between 25 and 75`, clicks "Save", selects L4, enters `24` in "Formula bar", and presses Enter.
  await page.goto('/'); await activate(page, "EVO-M05-VALIDATION-EDIT");
  await visible(named(page, "gridcell", "L4")); await named(page, "gridcell", "L4").click();
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Data validation",exact:true}).click();
  const dialog=named(page,'dialog','Data validation'); await visible(dialog); await fill(dialog,'Error message','Allocate between 25 and 75'); await button(dialog,'Save');
  await visible(named(page, "gridcell", "L4")); await named(page, "gridcell", "L4").click();
  await fill(page, 'Formula bar', "24"); await field(page, 'Formula bar').press('Enter');
  // THEN: The exact message "Allocate between 25 and 75" is visible, L4 remains `42`, and reopening "Data validation" after refresh shows the same "Error message" value.
  await expect(page.getByRole('alert')).toContainText('Allocate between 25 and 75');
  await visible(named(page, 'gridcell', "L4")); await expect(named(page, 'gridcell', "L4")).toHaveText("42");
  await page.reload();
  await visible(named(page, "gridcell", "L4")); await named(page, "gridcell", "L4").click();
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Data validation",exact:true}).click();
  await expect(field(dialog,'Error message')).toHaveValue('Allocate between 25 and 75');
});

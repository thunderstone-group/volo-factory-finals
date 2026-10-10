import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-1-1 - clear a formula and recalculate its dependent result", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M03-CLEAR-FORMULA` with active worksheet `Calculations`, cell B7 value `13`, cell C7 formula `=B7*5`, and cell D7 formula `=C7+2`.

  // WHEN: The visitor opens `EVO-M03-CLEAR-FORMULA`, selects cell C7, and presses Delete.
  await page.goto('/'); await activate(page, "EVO-M03-CLEAR-FORMULA");
  await visible(named(page, "gridcell", "C7")); await named(page, "gridcell", "C7").click();
  await page.keyboard.press('Delete');
  // THEN: Cell C7 and its "Formula bar" are empty, cell D7 displays `2`, and both results remain after refresh.
  await visible(named(page, 'gridcell', "C7")); await expect(named(page, 'gridcell', "C7")).toHaveText("");
  await expect(field(page, 'Formula bar')).toHaveValue('');
  await visible(named(page, 'gridcell', "D7")); await expect(named(page, 'gridcell', "D7")).toHaveText("2");
  await page.reload();
  await visible(named(page, 'gridcell', "C7")); await expect(named(page, 'gridcell', "C7")).toHaveText("");
  await visible(named(page, "gridcell", "C7")); await named(page, "gridcell", "C7").click();
  await expect(field(page, 'Formula bar')).toHaveValue('');
  await visible(named(page, 'gridcell', "D7")); await expect(named(page, 'gridcell', "D7")).toHaveText("2");
});

import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-2-1 - show a custom numeric error from the formula bar", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M05-VALIDATION-FORMULA` with active worksheet `Thresholds`, cell J6 value `37`, and a number-range validation rule of 25 to 75 with error message `Capacity must be from 25 to 75`.

  // WHEN: The visitor opens `EVO-M05-VALIDATION-FORMULA`, selects J6, enters `88` in "Formula bar", and presses Enter.
  await page.goto('/'); await activate(page, "EVO-M05-VALIDATION-FORMULA");
  await visible(named(page, "gridcell", "J6")); await named(page, "gridcell", "J6").click();
  await fill(page, 'Formula bar', "88"); await field(page, 'Formula bar').press('Enter');
  // THEN: The exact message "Capacity must be from 25 to 75" is visible, J6 remains `37`, and the same result occurs after refresh when entering `88` through "Formula bar".
  await expect(page.getByRole('alert')).toContainText('Capacity must be from 25 to 75');
  await visible(named(page, 'gridcell', "J6")); await expect(named(page, 'gridcell', "J6")).toHaveText("37");
  await page.reload();
  await visible(named(page, "gridcell", "J6")); await named(page, "gridcell", "J6").click();
  await fill(page, 'Formula bar', "88"); await field(page, 'Formula bar').press('Enter');
  await expect(page.getByRole('alert')).toContainText('Capacity must be from 25 to 75');
  await visible(named(page, 'gridcell', "J6")); await expect(named(page, 'gridcell', "J6")).toHaveText("37");
});

import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-1-1 - clear every cell in a selected rectangular range", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M03-CLEAR-RANGE` with active worksheet `Matrix`, where H4:I5 contains `Amber/Delta` and `Kite/Orchid` in row order.

  // WHEN: The visitor opens `EVO-M03-CLEAR-RANGE`, selects H4:I5, and presses Delete.
  await page.goto('/'); await activate(page, "EVO-M03-CLEAR-RANGE");
  await rectangle(page, 'H4', 'I5');
  await page.keyboard.press('Delete');
  // THEN: Cells H4, I4, H5, and I5 each display empty text and expose aria-selected="true"; after refresh all four cells remain empty.
  await visible(named(page, 'gridcell', "H4")); await expect(named(page, 'gridcell', "H4")).toHaveText("");
  await visible(named(page, 'gridcell', "I4")); await expect(named(page, 'gridcell', "I4")).toHaveText("");
  await visible(named(page, 'gridcell', "H5")); await expect(named(page, 'gridcell', "H5")).toHaveText("");
  await visible(named(page, 'gridcell', "I5")); await expect(named(page, 'gridcell', "I5")).toHaveText("");
  await expect(named(page, 'gridcell', 'H4')).toHaveAttribute('aria-selected','true');
  await expect(named(page, 'gridcell', 'I4')).toHaveAttribute('aria-selected','true');
  await expect(named(page, 'gridcell', 'H5')).toHaveAttribute('aria-selected','true');
  await expect(named(page, 'gridcell', 'I5')).toHaveAttribute('aria-selected','true');
  await page.reload();
  await visible(named(page, 'gridcell', "H4")); await expect(named(page, 'gridcell', "H4")).toHaveText("");
  await visible(named(page, 'gridcell', "I4")); await expect(named(page, 'gridcell', "I4")).toHaveText("");
  await visible(named(page, 'gridcell', "H5")); await expect(named(page, 'gridcell', "H5")).toHaveText("");
  await visible(named(page, 'gridcell', "I5")); await expect(named(page, 'gridcell', "I5")).toHaveText("");
});

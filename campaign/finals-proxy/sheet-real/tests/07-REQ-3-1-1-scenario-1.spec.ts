import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-3-1-1 - clear a text cell with Delete", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M03-CLEAR-TEXT` with active worksheet `Staging`, where cell H4 contains `obsolete tag`.

  // WHEN: The visitor opens `EVO-M03-CLEAR-TEXT`, selects cell H4, and presses Delete.
  await page.goto('/'); await activate(page, "EVO-M03-CLEAR-TEXT");
  await visible(named(page, "gridcell", "H4")); await named(page, "gridcell", "H4").click();
  await page.keyboard.press('Delete');
  // THEN: Cell H4 is selected and displays empty text; its "Formula bar" value is empty and remains empty after refresh.
  await visible(named(page, 'gridcell', "H4")); await expect(named(page, 'gridcell', "H4")).toHaveText("");
  await expect(named(page, 'gridcell', 'H4')).toHaveAttribute('aria-selected','true');
  await expect(field(page, 'Formula bar')).toHaveValue('');
  await page.reload();
  await visible(named(page, 'gridcell', "H4")); await expect(named(page, 'gridcell', "H4")).toHaveText("");
  await visible(named(page, "gridcell", "H4")); await named(page, "gridcell", "H4").click();
  await expect(field(page, 'Formula bar')).toHaveValue('');
});

import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-6-1-1 - freeze the first row", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N01-FREEZE-ROW` with active worksheet `ScrollLedger`, headers in row 1, and data through row 40.

  // WHEN: The visitor opens `EVO-N01-FREEZE-ROW`, selects B1, opens "View", and clicks "Freeze rows through 1".
  await page.goto('/'); await activate(page, "EVO-N01-FREEZE-ROW");
  await visible(named(page, "gridcell", "B1")); await named(page, "gridcell", "B1").click();
  await button(page, 'View'); await page.getByRole('menuitem', {name:"Freeze rows through 1",exact:true}).click();
  // THEN: The editor displays the button "Frozen rows: 1; columns: 0" and displays the same button after refresh.
  await visible(named(page,'button','Frozen rows: 1; columns: 0'));
  await page.reload();
  await visible(named(page,'button','Frozen rows: 1; columns: 0'));
});

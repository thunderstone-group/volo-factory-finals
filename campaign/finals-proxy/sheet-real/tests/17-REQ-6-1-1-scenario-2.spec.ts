import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-6-1-1 - freeze the first column", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N01-FREEZE-COLUMN` with active worksheet `ScrollLedger`, headers in row 1, and data through column L.

  // WHEN: The visitor opens `EVO-N01-FREEZE-COLUMN`, selects A8, opens "View", and clicks "Freeze columns through A".
  await page.goto('/'); await activate(page, "EVO-N01-FREEZE-COLUMN");
  await visible(named(page, "gridcell", "A8")); await named(page, "gridcell", "A8").click();
  await button(page, 'View'); await page.getByRole('menuitem', {name:"Freeze columns through A",exact:true}).click();
  // THEN: The editor displays the button "Frozen rows: 0; columns: 1" and displays the same button after refresh.
  await visible(named(page,'button','Frozen rows: 0; columns: 1'));
  await page.reload();
  await visible(named(page,'button','Frozen rows: 0; columns: 1'));
});

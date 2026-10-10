import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-6-1-1 - freeze both row and column panes", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N01-FREEZE-BOTH` with active worksheet `ScrollLedger`, headers in row 1, and data through row 40 and column L.

  // WHEN: The visitor opens `EVO-N01-FREEZE-BOTH`, selects C4, opens "View", and clicks "Freeze panes at C4".
  await page.goto('/'); await activate(page, "EVO-N01-FREEZE-BOTH");
  await visible(named(page, "gridcell", "C4")); await named(page, "gridcell", "C4").click();
  await button(page, 'View'); await page.getByRole('menuitem', {name:"Freeze panes at C4",exact:true}).click();
  // THEN: The editor displays the button "Frozen rows: 3; columns: 2" and displays the same button after refresh.
  await visible(named(page,'button','Frozen rows: 3; columns: 2'));
  await page.reload();
  await visible(named(page,'button','Frozen rows: 3; columns: 2'));
});

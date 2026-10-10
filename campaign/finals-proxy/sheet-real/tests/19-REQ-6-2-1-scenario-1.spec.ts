import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-6-2-1 - find the next matching cell", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N02-FIND-NEXT` with active worksheet `Narrative`, where E4, E7, and E11 contain `Cobalt`.

  // WHEN: The visitor opens `EVO-N02-FIND-NEXT`, selects A1, opens "Edit", clicks "Find and replace", enters `Cobalt` in "Find", and clicks "Find next" twice.
  await page.goto('/'); await activate(page, "EVO-N02-FIND-NEXT");
  await visible(named(page, "gridcell", "A1")); await named(page, "gridcell", "A1").click();
  await button(page, 'Edit'); await page.getByRole('menuitem', {name:"Find and replace",exact:true}).click();
  const dialog=named(page,'dialog','Find and replace'); await visible(dialog); await fill(dialog,'Find','Cobalt');
  await button(dialog,'Find next'); await button(dialog,'Find next');
  // THEN: Cell E7 is selected and the dialog displays exactly "Match 2 of 3".
  await expect(named(page,'gridcell','E7')).toHaveAttribute('aria-selected','true'); await text(dialog,'Match 2 of 3');
});

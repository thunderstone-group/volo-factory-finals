import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-8-1-1 - delete an existing cell note", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N05-NOTE-DELETE` with active worksheet `ReviewQueue`, where J3 contains `Route Zeta` and has note `Retire after audit`.

  // WHEN: The visitor opens `EVO-N05-NOTE-DELETE`, clicks "Open note for J3", and clicks "Delete note".
  await page.goto('/'); await activate(page, "EVO-N05-NOTE-DELETE");
  await button(page.getByRole('gridcell', {name:'J3',exact:true}), 'Open note for J3'); const dialog=named(page,'dialog','Note for J3'); await visible(dialog); await button(page,'Delete note');
  // THEN: "Open note for J3" is not visible, J3 still displays `Route Zeta`, and both results remain after refresh.
  await expect(named(page,'button','Open note for J3')).toHaveCount(0);
  await visible(named(page, 'gridcell', "J3")); await expect(named(page, 'gridcell', "J3")).toHaveText("Route Zeta");
  await page.reload();
  await expect(named(page,'button','Open note for J3')).toHaveCount(0);
  await visible(named(page, 'gridcell', "J3")); await expect(named(page, 'gridcell', "J3")).toHaveText("Route Zeta");
});

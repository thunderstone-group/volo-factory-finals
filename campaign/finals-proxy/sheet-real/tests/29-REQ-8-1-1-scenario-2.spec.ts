import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-8-1-1 - edit an existing cell note", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N05-NOTE-EDIT` with active worksheet `ReviewQueue`, where F6 contains `Gate Rho` and has note `Awaiting controller sign-off`.

  // WHEN: The visitor opens `EVO-N05-NOTE-EDIT`, clicks "Open note for F6", clicks "Edit note", replaces "Note" with `Controller signed at 14:20`, and clicks "Save note".
  await page.goto('/'); await activate(page, "EVO-N05-NOTE-EDIT");
  await button(page.getByRole('gridcell', {name:'F6',exact:true}), 'Open note for F6'); const dialog=named(page,'dialog','Note for F6'); await visible(dialog); await button(page,'Edit note'); await fill(dialog,'Note',"Controller signed at 14:20"); await button(dialog,'Save note');
  // THEN: Opening "Open note for F6" displays exactly `Controller signed at 14:20`, F6 still displays `Gate Rho`, and the updated note remains after refresh.
  await visible(named(page, 'gridcell', "F6")); await expect(named(page, 'gridcell', "F6")).toHaveText("Gate Rho");
  await button(page.getByRole('gridcell', {name:'F6',exact:true}), 'Open note for F6'); await visible(dialog); await expect(page.getByLabel('Note', {exact:true})).toHaveValue("Controller signed at 14:20");
  await page.reload();
  await visible(named(page, 'gridcell', "F6")); await expect(named(page, 'gridcell', "F6")).toHaveText("Gate Rho");
  await button(page.getByRole('gridcell', {name:'F6',exact:true}), 'Open note for F6'); await visible(dialog); await expect(page.getByLabel('Note', {exact:true})).toHaveValue("Controller signed at 14:20");
});

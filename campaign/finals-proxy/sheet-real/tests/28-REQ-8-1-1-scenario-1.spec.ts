import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-8-1-1 - create and persist a cell note", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N05-NOTE-CREATE` with active worksheet `ReviewQueue`, where D8 contains `Manifest R41` and has no note.

  // WHEN: The visitor opens `EVO-N05-NOTE-CREATE`, selects D8, opens "Insert", clicks "Add note", enters `Confirm the harbor reference before release` in "Note", and clicks "Save note".
  await page.goto('/'); await activate(page, "EVO-N05-NOTE-CREATE");
  await visible(named(page, "gridcell", "D8")); await named(page, "gridcell", "D8").click();
  await button(page, 'Insert'); await page.getByRole('menuitem', {name:"Add note",exact:true}).click();
  const dialog=named(page,'dialog','Note for D8'); await visible(dialog); await fill(dialog,'Note',"Confirm the harbor reference before release"); await button(dialog,'Save note');
  // THEN: D8 still displays `Manifest R41`, "Open note for D8" is visible, and opening it displays exactly `Confirm the harbor reference before release`, including after refresh.
  await visible(named(page, 'gridcell', "D8")); await expect(named(page, 'gridcell', "D8")).toHaveText("Manifest R41");
  await button(page.getByRole('gridcell', {name:'D8',exact:true}), 'Open note for D8'); await visible(dialog); await expect(page.getByLabel('Note', {exact:true})).toHaveValue("Confirm the harbor reference before release");
  await page.reload();
  await visible(named(page, 'gridcell', "D8")); await expect(named(page, 'gridcell', "D8")).toHaveText("Manifest R41");
  await button(page.getByRole('gridcell', {name:'D8',exact:true}), 'Open note for D8'); await visible(dialog); await expect(page.getByLabel('Note', {exact:true})).toHaveValue("Confirm the harbor reference before release");
});

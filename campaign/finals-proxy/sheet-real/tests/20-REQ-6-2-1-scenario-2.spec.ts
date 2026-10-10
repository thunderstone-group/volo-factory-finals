import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-6-2-1 - replace all matching text in the active worksheet", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N02-REPLACE-ALL` with active worksheet `Narrative`, where F3, F6, and F9 contain `Cobalt` and F12 contains `Copper`.

  // WHEN: The visitor opens `EVO-N02-REPLACE-ALL`, opens "Edit", clicks "Find and replace", enters `Cobalt` in "Find", enters `Indigo` in "Replace with", and clicks "Replace all".
  await page.goto('/'); await activate(page, "EVO-N02-REPLACE-ALL");
  await button(page, 'Edit'); await page.getByRole('menuitem', {name:"Find and replace",exact:true}).click();
  const dialog=named(page,'dialog','Find and replace'); await visible(dialog); await fill(dialog,'Find','Cobalt');
  await fill(dialog,'Replace with','Indigo'); await button(dialog,'Replace all');
  // THEN: The dialog displays exactly "Replaced 3 cells"; F3, F6, and F9 display `Indigo`, F12 displays `Copper`, and these values remain after refresh.
  await text(dialog,'Replaced 3 cells');
  await visible(named(page, 'gridcell', "F3")); await expect(named(page, 'gridcell', "F3")).toHaveText("Indigo");
  await visible(named(page, 'gridcell', "F6")); await expect(named(page, 'gridcell', "F6")).toHaveText("Indigo");
  await visible(named(page, 'gridcell', "F9")); await expect(named(page, 'gridcell', "F9")).toHaveText("Indigo");
  await visible(named(page, 'gridcell', "F12")); await expect(named(page, 'gridcell', "F12")).toHaveText("Copper");
  await page.reload();
  await visible(named(page, 'gridcell', "F3")); await expect(named(page, 'gridcell', "F3")).toHaveText("Indigo");
  await visible(named(page, 'gridcell', "F6")); await expect(named(page, 'gridcell', "F6")).toHaveText("Indigo");
  await visible(named(page, 'gridcell', "F9")); await expect(named(page, 'gridcell', "F9")).toHaveText("Indigo");
  await visible(named(page, 'gridcell', "F12")); await expect(named(page, 'gridcell', "F12")).toHaveText("Copper");
});

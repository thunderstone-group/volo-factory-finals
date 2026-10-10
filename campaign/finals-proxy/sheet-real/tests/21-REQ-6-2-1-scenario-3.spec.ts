import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-6-2-1 - replace only exact-case matches", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N02-CASE-SENSITIVE` with active worksheet `Narrative`, where G3 contains `Cobalt`, G4 contains `cobalt`, and G5 contains `Cobalt-7`.

  // WHEN: The visitor opens `EVO-N02-CASE-SENSITIVE`, opens "Edit", clicks "Find and replace", enters `Cobalt` in "Find", enters `Azure` in "Replace with", checks "Match case", and clicks "Replace all".
  await page.goto('/'); await activate(page, "EVO-N02-CASE-SENSITIVE");
  await button(page, 'Edit'); await page.getByRole('menuitem', {name:"Find and replace",exact:true}).click();
  const dialog=named(page,'dialog','Find and replace'); await visible(dialog); await fill(dialog,'Find','Cobalt');
  await fill(dialog,'Replace with','Azure'); await checked(dialog,'Match case',true); await button(dialog,'Replace all');
  // THEN: The dialog displays exactly "Replaced 1 cells"; G3 displays `Azure`, while G4 and G5 retain `cobalt` and `Cobalt-7` after refresh.
  await text(dialog,'Replaced 1 cells');
  await visible(named(page, 'gridcell', "G3")); await expect(named(page, 'gridcell', "G3")).toHaveText("Azure");
  await visible(named(page, 'gridcell', "G4")); await expect(named(page, 'gridcell', "G4")).toHaveText("cobalt");
  await visible(named(page, 'gridcell', "G5")); await expect(named(page, 'gridcell', "G5")).toHaveText("Cobalt-7");
  await page.reload();
  await visible(named(page, 'gridcell', "G3")); await expect(named(page, 'gridcell', "G3")).toHaveText("Azure");
  await visible(named(page, 'gridcell', "G4")); await expect(named(page, 'gridcell', "G4")).toHaveText("cobalt");
  await visible(named(page, 'gridcell', "G5")); await expect(named(page, 'gridcell', "G5")).toHaveText("Cobalt-7");
});

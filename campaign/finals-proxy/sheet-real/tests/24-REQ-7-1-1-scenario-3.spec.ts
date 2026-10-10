import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-7-1-1 - update an existing named range", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N03-NAMED-UPDATE` with active worksheet `ForecastModel`, named range `MarginBase` referring to K2:K3 with values `5` and `8`, value `12` in K4, and M2 formula `=SUM(MarginBase)`.

  // WHEN: The visitor opens `EVO-N03-NAMED-UPDATE`, opens "Data", clicks "Named ranges", clicks "Edit MarginBase", replaces "Range" with `ForecastModel!K2:K4`, and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-N03-NAMED-UPDATE");
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Named ranges",exact:true}).click();
  const dialog=named(page,'dialog','Named ranges'); await visible(dialog);
  await button(page,'Edit MarginBase'); await dialog.getByLabel('Range', {exact:true}).fill('ForecastModel!K2:K4'); await dialog.getByRole('button', {name:'Save',exact:true}).click();
  // THEN: M2 displays `25`; after refresh, "Edit MarginBase" shows `ForecastModel!K2:K4` in "Range" and M2 still displays `25`.
  await visible(named(page, 'gridcell', "M2")); await expect(named(page, 'gridcell', "M2")).toHaveText("25");
  await page.reload();
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Named ranges",exact:true}).click();
  await button(page,'Edit MarginBase'); await expect(field(page,'Range')).toHaveValue('ForecastModel!K2:K4');
  await visible(named(page, 'gridcell', "M2")); await expect(named(page, 'gridcell', "M2")).toHaveText("25");
});

import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-7-1-1 - reject an invalid named range name", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N03-NAMED-INVALID` with active worksheet `ForecastModel` and values `6` and `14` in K2:K3.

  // WHEN: The visitor opens `EVO-N03-NAMED-INVALID`, opens "Data", clicks "Named ranges", clicks "Add named range", enters `1stBatch` in "Name", enters `ForecastModel!K2:K3` in "Range", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-N03-NAMED-INVALID");
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Named ranges",exact:true}).click();
  const dialog=named(page,'dialog','Named ranges'); await visible(dialog);
  await button(page,'Add named range'); await fill(page,'Name','1stBatch'); await fill(page,'Range','ForecastModel!K2:K3'); await button(page,'Save');
  // THEN: The exact message "Named range must start with a letter" is visible, and "Named ranges" contains no entry named `1stBatch` after refresh.
  await text(page,'Named range must start with a letter'); await page.reload();
  await command(page, "Data"); await page.getByRole('menuitem', {name:"Named ranges",exact:true}).click();
  await visible(dialog); await expect(dialog.getByText('1stBatch',{exact:true})).toHaveCount(0); await expect(named(dialog,'button','Edit 1stBatch')).toHaveCount(0);
});

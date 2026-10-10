import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-7-2-1 - apply a numeric threshold format", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N04-FORMAT-NUMBER` with active worksheet `Signals`, where J4:J6 contain `11`, `29`, and `46`.

  // WHEN: The visitor opens `EVO-N04-FORMAT-NUMBER`, selects J4:J6, opens "Format", clicks "Conditional formatting", chooses "Greater than" in "Condition", enters `25` in "Value", chooses "Red fill" in "Style", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-N04-FORMAT-NUMBER");
  await rectangle(page,'J4','J6');
  await button(page, 'Format'); await page.getByRole('menuitem', {name:"Conditional formatting",exact:true}).click();
  const dialog=named(page,'dialog','Conditional formatting'); await visible(dialog);
  await choose(dialog,'Condition','Greater than'); await fill(dialog,'Value','25'); await choose(dialog,'Style','Red fill'); await button(dialog,'Save');
  // THEN: J5 and J6 have background color rgb(254, 226, 226), J4 does not have that color, and the same colors remain after refresh.
  await expect(named(page,'gridcell','J5')).toHaveCSS('background-color','rgb(254, 226, 226)');
  await expect(named(page,'gridcell','J6')).toHaveCSS('background-color','rgb(254, 226, 226)');
  await expect(named(page,'gridcell','J4')).not.toHaveCSS('background-color','rgb(254, 226, 226)');
  await page.reload();
  await expect(named(page,'gridcell','J5')).toHaveCSS('background-color','rgb(254, 226, 226)');
  await expect(named(page,'gridcell','J6')).toHaveCSS('background-color','rgb(254, 226, 226)');
  await expect(named(page,'gridcell','J4')).not.toHaveCSS('background-color','rgb(254, 226, 226)');
});

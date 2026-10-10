import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-7-2-1 - apply a text-match format", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N04-FORMAT-TEXT` with active worksheet `Signals`, where K4:K6 contain `Watch`, `Stable`, and `Elevated`.

  // WHEN: The visitor opens `EVO-N04-FORMAT-TEXT`, selects K4:K6, opens "Format", clicks "Conditional formatting", chooses "Text contains" in "Condition", enters `Watch` in "Value", chooses "Yellow fill" in "Style", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-N04-FORMAT-TEXT");
  await rectangle(page,'K4','K6');
  await button(page, 'Format'); await page.getByRole('menuitem', {name:"Conditional formatting",exact:true}).click();
  const dialog=named(page,'dialog','Conditional formatting'); await visible(dialog);
  await choose(dialog,'Condition','Text contains'); await fill(dialog,'Value','Watch'); await choose(dialog,'Style','Yellow fill'); await button(dialog,'Save');
  // THEN: K4 has background color rgb(254, 249, 195), K5 and K6 do not have that color, and the rule remains listed after refresh.
  await expect(named(page,'gridcell','K4')).toHaveCSS('background-color','rgb(254, 249, 195)');
  await expect(named(page,'gridcell','K5')).not.toHaveCSS('background-color','rgb(254, 249, 195)');
  await expect(named(page,'gridcell','K6')).not.toHaveCSS('background-color','rgb(254, 249, 195)');
  await page.reload();
  await expect(named(page,'gridcell','K4')).toHaveCSS('background-color','rgb(254, 249, 195)');
  await expect(named(page,'gridcell','K5')).not.toHaveCSS('background-color','rgb(254, 249, 195)');
  await expect(named(page,'gridcell','K6')).not.toHaveCSS('background-color','rgb(254, 249, 195)');
  await button(page, 'Format'); await page.getByRole('menuitem', {name:"Conditional formatting",exact:true}).click();
  await visible(named(page,'button','Edit rule 1'));
});

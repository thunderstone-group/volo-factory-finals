import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-7-2-1 - edit and delete a conditional formatting rule", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-N04-FORMAT-EDIT` with active worksheet `Signals`, cells L3:L5 containing `16`, `28`, and `39`, and rule 1 applying Red fill for values greater than 20.

  // WHEN: The visitor opens `EVO-N04-FORMAT-EDIT`, opens "Format", clicks "Conditional formatting", clicks "Edit rule 1", chooses "Green fill" in "Style", clicks "Save", then reopens "Conditional formatting" and clicks "Delete rule 1".
  await page.goto('/'); await activate(page, "EVO-N04-FORMAT-EDIT");
  await button(page, 'Format'); await page.getByRole('menuitem', {name:"Conditional formatting",exact:true}).click();
  const dialog=named(page,'dialog','Conditional formatting'); await visible(dialog);
  await button(dialog,'Edit rule 1'); await choose(dialog,'Style','Green fill'); await button(dialog,'Save');
  // Observe the intermediate edited style before executing the published deletion.
  for (const c of ['L4','L5']) await expect(named(page,'gridcell',c)).toHaveCSS('background-color','rgb(220, 252, 231)'); await dismissDialogs(page);
  await button(page, 'Format'); await page.getByRole('menuitem', {name:"Conditional formatting",exact:true}).click();
  await button(page,'Delete rule 1');
  // THEN: L4 and L5 briefly use background color rgb(220, 252, 231) after the edit, and after deletion none of L3:L5 has a conditional background color, including after refresh.
  for (const c of ['L3','L4','L5']) for (const color of ['rgb(254, 226, 226)','rgb(254, 249, 195)','rgb(220, 252, 231)']) await expect(named(page,'gridcell',c)).not.toHaveCSS('background-color',color);
  await page.reload();
  for (const c of ['L3','L4','L5']) for (const color of ['rgb(254, 226, 226)','rgb(254, 249, 195)','rgb(220, 252, 231)']) await expect(named(page,'gridcell',c)).not.toHaveCSS('background-color',color);
});

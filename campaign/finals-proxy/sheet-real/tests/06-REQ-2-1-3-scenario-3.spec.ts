import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-2-1-3 - reject a worksheet name longer than 50 characters", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M02-SHEET-LIMIT` with active worksheet `LengthGauge` and cell G4 value `sheet sentinel`.

  // WHEN: The visitor opens `EVO-M02-SHEET-LIMIT`, opens "Worksheet options for LengthGauge", clicks "Rename", enters the 51-character value `BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB` in "Worksheet name", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-M02-SHEET-LIMIT");
  await button(page, 'Worksheet options for LengthGauge'); await command(page, 'Rename'); const dialog = named(page, 'dialog', 'Rename worksheet'); await visible(dialog); await fill(dialog, 'Worksheet name', "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"); await button(dialog, 'Save');
  // THEN: The exact message "Worksheet name must be 50 characters or fewer" is visible; after refresh `LengthGauge` remains active and cell G4 displays `sheet sentinel`.
  await text(page, "Worksheet name must be 50 characters or fewer"); await visible(named(page, 'tab', 'LengthGauge')); await expect(named(page, 'tab', 'LengthGauge')).toHaveAttribute('aria-selected', 'true'); await page.reload(); await expect(named(page, 'tab', 'LengthGauge')).toHaveAttribute('aria-selected', 'true');
  await visible(named(page, 'gridcell', "G4")); await expect(named(page, 'gridcell', "G4")).toHaveText("sheet sentinel");
});

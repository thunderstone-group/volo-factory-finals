import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-2-1-3 - reject a worksheet name differing only by case", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M02-SHEET-DUP` with worksheets `Meridian` and `ArchiveBay`, with `ArchiveBay` active.

  // WHEN: The visitor opens `EVO-M02-SHEET-DUP`, opens "Worksheet options for ArchiveBay", clicks "Rename", enters `meridian` in "Worksheet name", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-M02-SHEET-DUP");
  await button(page, 'Worksheet options for ArchiveBay'); await command(page, 'Rename'); const dialog = named(page, 'dialog', 'Rename worksheet'); await visible(dialog); await fill(dialog, 'Worksheet name', "meridian"); await button(dialog, 'Save');
  // THEN: The exact message "Worksheet name already exists" is visible; `ArchiveBay` remains the active tab and the rename dialog still contains `ArchiveBay` after refresh.
  await text(page, "Worksheet name already exists"); await visible(named(page, 'tab', 'ArchiveBay')); await expect(named(page, 'tab', 'ArchiveBay')).toHaveAttribute('aria-selected', 'true'); await page.reload(); await expect(named(page, 'tab', 'ArchiveBay')).toHaveAttribute('aria-selected', 'true');
  await button(page, 'Worksheet options for ArchiveBay'); await command(page, 'Rename'); await visible(dialog); await expect(field(dialog, 'Worksheet name')).toHaveValue('ArchiveBay');
});

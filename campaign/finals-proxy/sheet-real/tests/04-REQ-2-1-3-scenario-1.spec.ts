import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-2-1-3 - trim and persist an available worksheet name", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M02-SHEET-OK` with active worksheet `HarborDraft`, worksheet `LedgerView`, and cell D5 value `dock marker` in `HarborDraft`.

  // WHEN: The visitor opens `EVO-M02-SHEET-OK`, opens "Worksheet options for HarborDraft", clicks "Rename", enters `  Dispatch Register  ` in "Worksheet name", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-M02-SHEET-OK");
  await button(page, 'Worksheet options for HarborDraft'); await command(page, 'Rename'); const dialog = named(page, 'dialog', 'Rename worksheet'); await visible(dialog); await fill(dialog, 'Worksheet name', "  Dispatch Register  "); await button(dialog, 'Save');
  // THEN: The active tab is exactly `Dispatch Register`; after refresh it remains active, cell D5 displays `dock marker`, and the rename dialog is prefilled with `Dispatch Register`.
  await visible(named(page, 'tab', 'Dispatch Register')); await expect(named(page, 'tab', 'Dispatch Register')).toHaveAttribute('aria-selected', 'true'); await page.reload(); await expect(named(page, 'tab', 'Dispatch Register')).toHaveAttribute('aria-selected', 'true');
  await visible(named(page, 'gridcell', "D5")); await expect(named(page, 'gridcell', "D5")).toHaveText("dock marker");
  await button(page, 'Worksheet options for Dispatch Register'); await command(page, 'Rename'); await visible(dialog); await expect(field(dialog, 'Worksheet name')).toHaveValue('Dispatch Register');
});

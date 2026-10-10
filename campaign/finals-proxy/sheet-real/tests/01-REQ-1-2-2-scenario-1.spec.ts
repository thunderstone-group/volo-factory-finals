import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-2-2 - trim and persist an available workbook name", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M01-RENAME-OK` with active worksheet `IdentityLog` and cell F3 value `unreviewed`.

  // WHEN: The visitor opens `EVO-M01-RENAME-OK`, clicks "Rename workbook", enters `  FY26 Procurement Ledger  ` in "Workbook name", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-M01-RENAME-OK");
  await button(page, 'Rename workbook'); await fill(page, 'Workbook name', "  FY26 Procurement Ledger  "); await button(page, 'Save');
  // THEN: The editor displays exactly `FY26 Procurement Ledger`; after refresh, "Workbook name" is prefilled with exactly `FY26 Procurement Ledger` and cell F3 still displays `unreviewed`.
  await visible(named(page, 'heading', 'FY26 Procurement Ledger')); await page.reload(); await button(page, 'Rename workbook'); await expect(field(page, 'Workbook name')).toHaveValue('FY26 Procurement Ledger');
  await visible(named(page, 'gridcell', "F3")); await expect(named(page, 'gridcell', "F3")).toHaveText("unreviewed");
});

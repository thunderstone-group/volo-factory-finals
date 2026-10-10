import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-2-2 - reject a case-insensitive duplicate workbook name", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M01-RENAME-DUP` with active worksheet `IdentityLog`, plus a separate workbook named `EVO-M01-ARCHIVE-RESERVED`.

  // WHEN: The visitor opens `EVO-M01-RENAME-DUP`, clicks "Rename workbook", enters `evo-m01-archive-reserved` in "Workbook name", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-M01-RENAME-DUP");
  await button(page, 'Rename workbook'); await fill(page, 'Workbook name', "evo-m01-archive-reserved"); await button(page, 'Save');
  // THEN: The exact message "Workbook name already exists" is visible; the editor title and the "Workbook name" field still display `EVO-M01-RENAME-DUP`, including after refresh.
  await text(page, 'Workbook name already exists'); await visible(named(page, 'heading', 'EVO-M01-RENAME-DUP')); await expect(field(page, 'Workbook name')).toHaveValue('EVO-M01-RENAME-DUP'); await page.reload(); await visible(named(page, 'heading', 'EVO-M01-RENAME-DUP')); await button(page, 'Rename workbook'); await expect(field(page, 'Workbook name')).toHaveValue('EVO-M01-RENAME-DUP');
});

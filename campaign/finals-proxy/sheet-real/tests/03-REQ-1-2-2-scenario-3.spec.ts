import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-1-2-2 - reject a workbook name longer than 80 characters", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M01-RENAME-LIMIT` with active worksheet `LimitProbe` and cell C2 value `limit sentinel`.

  // WHEN: The visitor opens `EVO-M01-RENAME-LIMIT`, clicks "Rename workbook", enters the 81-character value `EVO-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` in "Workbook name", and clicks "Save".
  await page.goto('/'); await activate(page, "EVO-M01-RENAME-LIMIT");
  await button(page, 'Rename workbook'); await fill(page, 'Workbook name', "EVO-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); await button(page, 'Save');
  // THEN: The exact message "Workbook name must be 80 characters or fewer" is visible; after refresh the title remains `EVO-M01-RENAME-LIMIT` and cell C2 displays `limit sentinel`.
  await text(page, 'Workbook name must be 80 characters or fewer'); await page.reload(); await visible(named(page, 'heading', 'EVO-M01-RENAME-LIMIT'));
  await visible(named(page, 'gridcell', "C2")); await expect(named(page, 'gridcell', "C2")).toHaveText("limit sentinel");
});

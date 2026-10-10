import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';
import { command, unavailable, rectangle, dismissDialogs, savedView, reactionCount, issueContent, openPublicIssue } from './interactions';

test.use({ storageState: { cookies: [], origins: [] } });

test("REQ-5-2-1 - show a custom dropdown error from the grid", async ({ page, browser, baseURL }) => {
  // GIVEN: The visitor is unauthenticated and the system pre-provisions workbook `EVO-M05-VALIDATION-GRID` with active worksheet `Thresholds`, cell K8 value `Ready`, and a dropdown rule `Ready, Holding, Released` with error message `Choose a queue state`.

  // WHEN: The visitor opens `EVO-M05-VALIDATION-GRID`, edits K8 through its grid editor, enters `Paused`, and presses Enter.
  await page.goto('/'); await activate(page, "EVO-M05-VALIDATION-GRID");
  await visible(named(page, 'gridcell', 'K8')); await named(page, 'gridcell', 'K8').dblclick(); await page.locator(':focus').fill('Paused'); await page.locator(':focus').press('Enter');
  // THEN: The exact message "Choose a queue state" is visible; K8 remains `Ready`, and after refresh the same invalid grid entry is rejected with the same message.
  await expect(page.getByRole('alert')).toContainText('Choose a queue state');
  await visible(named(page, 'gridcell', "K8")); await expect(named(page, 'gridcell', "K8")).toContainText("Ready");
  await page.reload();
  await visible(named(page, 'gridcell', 'K8')); await named(page, 'gridcell', 'K8').dblclick(); await page.locator(':focus').fill('Paused'); await page.locator(':focus').press('Enter');
  await expect(page.getByRole('alert')).toContainText('Choose a queue state');
  await visible(named(page, 'gridcell', "K8")); await expect(named(page, 'gridcell', "K8")).toContainText("Ready");
});

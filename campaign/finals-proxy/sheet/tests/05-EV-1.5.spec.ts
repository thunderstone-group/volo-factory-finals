import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.5: Recalculate cross-worksheet references", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Recalculate EV-1.5" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. Tabs are Sheet1 and Rates; Sheet1!A1=10, Rates!A1=2. Sheet1 is active.
  // WHEN: The user activates "Recalculate EV-1.5" in the current page.
  await activate(page, "Recalculate EV-1.5");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // WHEN: The user enters "=A1*'Rates'!A1" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "=A1*'Rates'!A1");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "20".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("20");
  // WHEN: The user clicks the tab named "Rates" in the current page.
  await visible(named(page, "tab", "Rates")); await named(page, "tab", "Rates").click();
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // WHEN: The user enters "3" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "3");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // WHEN: The user clicks the tab named "Sheet1" in the current page.
  await visible(named(page, "tab", "Sheet1")); await named(page, "tab", "Sheet1").click();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "30".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("30");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "30".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("30");
});

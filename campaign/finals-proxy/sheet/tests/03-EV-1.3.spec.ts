import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.3: Sum matching rows with SUMIF", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Sum EV-1.3" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=East, A2=West, A3=East; B1=12, B2=99, B3=8.
  // WHEN: The user activates "Sum EV-1.3" in the current page.
  await activate(page, "Sum EV-1.3");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "C1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "C1").click();
  // WHEN: The user enters "=SUMIF(A1:A3,\"East\",B1:B3)" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "=SUMIF(A1:A3,\"East\",B1:B3)");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "20".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("20");
  // WHEN: The user clicks the gridcell named "B2" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B2").click();
  // WHEN: The user enters "1000" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "1000");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "20".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("20");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "20".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("20");
});

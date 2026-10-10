import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.1: Calculate IF with a comparison", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Calculate EV-1.1" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=12 and B1 is blank.
  // WHEN: The user activates "Calculate EV-1.1" in the current page.
  await activate(page, "Calculate EV-1.1");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // WHEN: The user enters "=IF(A1>=10,\"Ready\",\"Wait\")" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "=IF(A1>=10,\"Ready\",\"Wait\")");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "Ready".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("Ready");
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // WHEN: The user enters "4" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "4");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "Wait".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("Wait");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "Wait".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("Wait");
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // THEN: The "Formula bar" field in the current page displays "=IF(A1>=10,\"Ready\",\"Wait\")".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("=IF(A1>=10,\"Ready\",\"Wait\")");
});

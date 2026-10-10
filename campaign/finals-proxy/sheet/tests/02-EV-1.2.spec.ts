import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.2: Count matching values with COUNTIF", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Count EV-1.2" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=5, A2=10, A3=15, A4=20. B1 is blank.
  // WHEN: The user activates "Count EV-1.2" in the current page.
  await activate(page, "Count EV-1.2");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // WHEN: The user enters "=COUNTIF(A1:A4,\">10\")" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "=COUNTIF(A1:A4,\">10\")");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "2".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("2");
  // WHEN: The user clicks the gridcell named "A2" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A2").click();
  // WHEN: The user enters "11" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "11");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "3".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("3");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "3".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("3");
});

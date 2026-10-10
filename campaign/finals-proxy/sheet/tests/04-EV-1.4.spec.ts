import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.4: Recover from formula errors with IFERROR", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Recover EV-1.4" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=0 and C1 has formula =1/0.
  // WHEN: The user activates "Recover EV-1.4" in the current page.
  await activate(page, "Recover EV-1.4");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // WHEN: The user enters "=IFERROR(10/A1,\"Pending\")" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "=IFERROR(10/A1,\"Pending\")");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "Pending".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("Pending");
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "#DIV/0!".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("#DIV/0!");
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // WHEN: The user enters "2" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "2");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "5".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("5");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "5".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("5");
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "#DIV/0!".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("#DIV/0!");
});

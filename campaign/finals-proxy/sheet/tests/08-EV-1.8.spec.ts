import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.8: Paste only calculated values", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Paste EV-1.8" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=7; B1 has formula =A1*2; D1 is blank.
  // WHEN: The user activates "Paste EV-1.8" in the current page.
  await activate(page, "Paste EV-1.8");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // WHEN: The user presses "Control+c" on the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").press("Control+c");
  // WHEN: The user right-clicks the gridcell named "D1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "D1").click({ button: "right" });
  // WHEN: The user clicks the menuitem named "Paste values only" in the current page.
  await visible(named(page, "menuitem", "Paste values only")); await named(page, "menuitem", "Paste values only").click();
  // THEN: The gridcell named "D1" in the grid named "Worksheet grid" has exact text "14".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")).toHaveText("14");
  // WHEN: The user clicks the gridcell named "D1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "D1").click();
  // THEN: The "Formula bar" field in the current page displays "14".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("14");
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // WHEN: The user enters "8" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "8");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "16".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("16");
  // THEN: The gridcell named "D1" in the grid named "Worksheet grid" has exact text "14".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")).toHaveText("14");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "D1" in the grid named "Worksheet grid" has exact text "14".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")).toHaveText("14");
});

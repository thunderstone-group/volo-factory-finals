import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.1: Create a named range for formulas", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Create EV-2.1" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=2,A2=3,A3=5.
  // WHEN: The user activates "Create EV-2.1" in the current page.
  await activate(page, "Create EV-2.1");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Named ranges" in the current page.
  await visible(named(page, "menuitem", "Named ranges")); await named(page, "menuitem", "Named ranges").click();
  // WHEN: The user clicks the button named "Add named range" in the region named "Named ranges".
  await button(named(page, "region", "Named ranges"), "Add named range");
  // WHEN: The user enters "Revenue" in the "Name" field in the dialog named "Named range".
  await fill(named(page, "dialog", "Named range"), "Name", "Revenue");
  // WHEN: The user enters "A1:A3" in the "Range" field in the dialog named "Named range".
  await fill(named(page, "dialog", "Named range"), "Range", "A1:A3");
  // WHEN: The user clicks the button named "Save" in the dialog named "Named range".
  await button(named(page, "dialog", "Named range"), "Save");
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // WHEN: The user enters "=SUM(Revenue)" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "=SUM(Revenue)");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "10".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("10");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "10".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("10");
});

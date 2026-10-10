import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.2: Rename a named range and its references", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Rename EV-2.2" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=4,A2=6; named range Revenue refers to Sheet1!A1:A2; B1 has formula =SUM(Revenue).
  // WHEN: The user activates "Rename EV-2.2" in the current page.
  await activate(page, "Rename EV-2.2");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Named ranges" in the current page.
  await visible(named(page, "menuitem", "Named ranges")); await named(page, "menuitem", "Named ranges").click();
  // WHEN: The user clicks the button named "Edit" in the region named "Revenue".
  await button(named(page, "region", "Revenue"), "Edit");
  // WHEN: The user enters "SalesTotal" in the "Name" field in the dialog named "Named range".
  await fill(named(page, "dialog", "Named range"), "Name", "SalesTotal");
  // WHEN: The user clicks the button named "Save" in the dialog named "Named range".
  await button(named(page, "dialog", "Named range"), "Save");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "10".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("10");
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // THEN: The "Formula bar" field in the current page displays "=SUM(SalesTotal)".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("=SUM(SalesTotal)");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "10".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("10");
  // THEN: The "Formula bar" field in the current page displays "=SUM(SalesTotal)".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("=SUM(SalesTotal)");
});

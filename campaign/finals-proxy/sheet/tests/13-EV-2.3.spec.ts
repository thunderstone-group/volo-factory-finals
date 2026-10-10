import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.3: Delete a named range without deleting data", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Delete EV-2.3" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=4,A2=6; Revenue refers to Sheet1!A1:A2; B1 has formula =SUM(Revenue).
  // WHEN: The user activates "Delete EV-2.3" in the current page.
  await activate(page, "Delete EV-2.3");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Named ranges" in the current page.
  await visible(named(page, "menuitem", "Named ranges")); await named(page, "menuitem", "Named ranges").click();
  // WHEN: The user clicks the button named "Delete" in the region named "Revenue".
  await button(named(page, "region", "Revenue"), "Delete");
  // WHEN: The user clicks the button named "Delete" in the dialog named "Delete named range".
  await button(named(page, "dialog", "Delete named range"), "Delete");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "4".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("4");
  // THEN: The gridcell named "A2" in the grid named "Worksheet grid" has exact text "6".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")).toHaveText("6");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "#NAME?".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("#NAME?");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "#NAME?".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("#NAME?");
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // THEN: The "Formula bar" field in the current page displays "=SUM(Revenue)".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("=SUM(Revenue)");
});

import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.6: Replace text inside formulas", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Replace EV-2.6" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=2,A2=5; B1 has formula =A1*2 and B2 has formula =A1+1.
  // WHEN: The user activates "Replace EV-2.6" in the current page.
  await activate(page, "Replace EV-2.6");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Find and replace" in the current page.
  await button(page, "Find and replace");
  // WHEN: The user enters "A1" in the "Find" field in the dialog named "Find and replace".
  await fill(named(page, "dialog", "Find and replace"), "Find", "A1");
  // WHEN: The user enters "A2" in the "Replace with" field in the dialog named "Find and replace".
  await fill(named(page, "dialog", "Find and replace"), "Replace with", "A2");
  // WHEN: The user checks "Search in formulas" in the dialog named "Find and replace".
  await checked(named(page, "dialog", "Find and replace"), "Search in formulas", true);
  // WHEN: The user clicks the button named "Replace all" in the dialog named "Find and replace".
  await button(named(page, "dialog", "Find and replace"), "Replace all");
  // THEN: The exact text "2 replacements" is visible exactly once in the dialog named "Find and replace".
  await text(named(page, "dialog", "Find and replace"), "2 replacements");
  // WHEN: The user clicks the button named "Close" in the dialog named "Find and replace".
  await button(named(page, "dialog", "Find and replace"), "Close");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "10".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("10");
  // THEN: The gridcell named "B2" in the grid named "Worksheet grid" has exact text "6".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")).toHaveText("6");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "10".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("10");
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // THEN: The "Formula bar" field in the current page displays "=A2*2".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("=A2*2");
});

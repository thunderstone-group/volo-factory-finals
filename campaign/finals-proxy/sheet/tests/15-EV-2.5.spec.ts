import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.5: Replace all text on the active worksheet", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Replace EV-2.5" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. Tabs are Sheet1 and Other. Sheet1 has A1=cat, A2=catfish, A3=dog; Other!A1=cat. Sheet1 is active.
  // WHEN: The user activates "Replace EV-2.5" in the current page.
  await activate(page, "Replace EV-2.5");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Find and replace" in the current page.
  await button(page, "Find and replace");
  // WHEN: The user enters "cat" in the "Find" field in the dialog named "Find and replace".
  await fill(named(page, "dialog", "Find and replace"), "Find", "cat");
  // WHEN: The user enters "fox" in the "Replace with" field in the dialog named "Find and replace".
  await fill(named(page, "dialog", "Find and replace"), "Replace with", "fox");
  // WHEN: The user clicks the button named "Replace all" in the dialog named "Find and replace".
  await button(named(page, "dialog", "Find and replace"), "Replace all");
  // THEN: The exact text "2 replacements" is visible exactly once in the dialog named "Find and replace".
  await text(named(page, "dialog", "Find and replace"), "2 replacements");
  // WHEN: The user clicks the button named "Close" in the dialog named "Find and replace".
  await button(named(page, "dialog", "Find and replace"), "Close");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "fox".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("fox");
  // THEN: The gridcell named "A2" in the grid named "Worksheet grid" has exact text "foxfish".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")).toHaveText("foxfish");
  // WHEN: The user clicks the tab named "Other" in the current page.
  await visible(named(page, "tab", "Other")); await named(page, "tab", "Other").click();
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "cat".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("cat");
  // WHEN: The user clicks the tab named "Sheet1" in the current page.
  await visible(named(page, "tab", "Sheet1")); await named(page, "tab", "Sheet1").click();
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "A2" in the grid named "Worksheet grid" has exact text "foxfish".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")).toHaveText("foxfish");
});

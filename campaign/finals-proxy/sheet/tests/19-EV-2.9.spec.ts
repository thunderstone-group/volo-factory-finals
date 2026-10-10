import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.9: Show a hidden worksheet", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Show EV-2.9" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. Sheet1 is visible and active with A1=Current. Archive follows it, hidden, with A1=Retained.
  // WHEN: The user activates "Show EV-2.9" in the current page.
  await activate(page, "Show EV-2.9");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Hidden sheets" in the current page.
  await button(page, "Hidden sheets");
  // WHEN: The user clicks the button named "Show Archive" in the dialog named "Hidden sheets".
  await button(named(page, "dialog", "Hidden sheets"), "Show Archive");
  // THEN: The tab named "Archive" in the current page has selected state "true".
  await visible(named(page, "tab", "Archive")); await expect(named(page, "tab", "Archive")).toHaveAttribute("aria-selected", "true");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "Retained".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("Retained");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The tab named "Archive" is visible exactly once in the current page.
  await visible(named(page, "tab", "Archive"));
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "Retained".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("Retained");
});

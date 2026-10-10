import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.8: Hide a worksheet without losing its data", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Hide EV-2.8" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. Tabs are Sheet1 and Archive; Sheet1!A1=Current, Archive!A1=Retained. Archive is active.
  // WHEN: The user activates "Hide EV-2.8" in the current page.
  await activate(page, "Hide EV-2.8");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Worksheet options for Archive" in the current page.
  await button(page, "Worksheet options for Archive");
  // WHEN: The user clicks the menuitem named "Hide" in the current page.
  await visible(named(page, "menuitem", "Hide")); await named(page, "menuitem", "Hide").click();
  // THEN: The tab named "Archive" is absent in the current page.
  await expect(named(page, "tab", "Archive")).toHaveCount(0);
  // THEN: The tab named "Sheet1" in the current page has selected state "true".
  await visible(named(page, "tab", "Sheet1")); await expect(named(page, "tab", "Sheet1")).toHaveAttribute("aria-selected", "true");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "Current".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("Current");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The tab named "Archive" is absent in the current page.
  await expect(named(page, "tab", "Archive")).toHaveCount(0);
  // WHEN: The user clicks the button named "Hidden sheets" in the current page.
  await button(page, "Hidden sheets");
  // THEN: The button named "Show Archive" is visible exactly once in the dialog named "Hidden sheets".
  await visible(named(named(page, "dialog", "Hidden sheets"), "button", "Show Archive"));
});

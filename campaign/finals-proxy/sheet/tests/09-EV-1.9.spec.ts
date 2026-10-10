import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.9: Undo and redo a worksheet rename", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Undo EV-1.9" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. Sheet1!A1=Preserved.
  // WHEN: The user activates "Undo EV-1.9" in the current page.
  await activate(page, "Undo EV-1.9");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Worksheet options for Sheet1" in the current page.
  await button(page, "Worksheet options for Sheet1");
  // WHEN: The user clicks the menuitem named "Rename" in the current page.
  await visible(named(page, "menuitem", "Rename")); await named(page, "menuitem", "Rename").click();
  // WHEN: The user enters "Renamed EV-1.9" in the "Worksheet name" field in the dialog named "Rename worksheet".
  await fill(named(page, "dialog", "Rename worksheet"), "Worksheet name", "Renamed EV-1.9");
  // WHEN: The user clicks the button named "Save" in the dialog named "Rename worksheet".
  await button(named(page, "dialog", "Rename worksheet"), "Save");
  // WHEN: The user clicks the button named "Undo" in the current page.
  await button(page, "Undo");
  // THEN: The tab named "Sheet1" is visible exactly once in the current page.
  await visible(named(page, "tab", "Sheet1"));
  // THEN: The tab named "Renamed EV-1.9" is absent in the current page.
  await expect(named(page, "tab", "Renamed EV-1.9")).toHaveCount(0);
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "Preserved".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("Preserved");
  // WHEN: The user clicks the button named "Redo" in the current page.
  await button(page, "Redo");
  // THEN: The tab named "Renamed EV-1.9" is visible exactly once in the current page.
  await visible(named(page, "tab", "Renamed EV-1.9"));
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The tab named "Renamed EV-1.9" is visible exactly once in the current page.
  await visible(named(page, "tab", "Renamed EV-1.9"));
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "Preserved".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("Preserved");
});

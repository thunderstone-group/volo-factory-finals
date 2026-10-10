import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.7: Hide a column without deleting its values", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Hide EV-3.7" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=2,B1=8,C1 has formula =A1+B1.
  // WHEN: The user activates "Hide EV-3.7" in the current page.
  await activate(page, "Hide EV-3.7");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user right-clicks the columnheader named "B" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "columnheader", "B")); await named(named(page, "grid", "Worksheet grid"), "columnheader", "B").click({ button: "right" });
  // WHEN: The user clicks the menuitem named "Hide column" in the current page.
  await visible(named(page, "menuitem", "Hide column")); await named(page, "menuitem", "Hide column").click();
  // THEN: The columnheader named "B" is absent in the grid named "Worksheet grid".
  await expect(named(named(page, "grid", "Worksheet grid"), "columnheader", "B")).toHaveCount(0);
  // THEN: The gridcell named "B1" is absent in the grid named "Worksheet grid".
  await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveCount(0);
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "10".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("10");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" is absent in the grid named "Worksheet grid".
  await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveCount(0);
  // THEN: The button named "Show column B" is visible exactly once in the current page.
  await visible(named(page, "button", "Show column B"));
});

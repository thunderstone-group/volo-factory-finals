import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.10: Move a worksheet left", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Move EV-2.10" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. Visible tabs are Sheet1, Second, Third in that order; Third is active with A1=Third data. Other sheets are blank.
  // WHEN: The user activates "Move EV-2.10" in the current page.
  await activate(page, "Move EV-2.10");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Worksheet options for Third" in the current page.
  await button(page, "Worksheet options for Third");
  // WHEN: The user clicks the menuitem named "Move left" in the current page.
  await visible(named(page, "menuitem", "Move left")); await named(page, "menuitem", "Move left").click();
  // THEN: The "Worksheet order" list in the current page contains exactly these entries in order: ["Sheet1", "Third", "Second"].
  await order(page, "Worksheet order", ["Sheet1", "Third", "Second"]);
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "Third data".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("Third data");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The "Worksheet order" list in the current page contains exactly these entries in order: ["Sheet1", "Third", "Second"].
  await order(page, "Worksheet order", ["Sheet1", "Third", "Second"]);
  // THEN: The tab named "Third" in the current page has selected state "true".
  await visible(named(page, "tab", "Third")); await expect(named(page, "tab", "Third")).toHaveAttribute("aria-selected", "true");
});

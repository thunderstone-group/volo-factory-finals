import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.9: Toggle display of formula expressions", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Toggle EV-3.9" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=3,B1 has formula =A1*4.
  // WHEN: The user activates "Toggle EV-3.9" in the current page.
  await activate(page, "Toggle EV-3.9");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "View" in the current page.
  await button(page, "View");
  // WHEN: The user clicks the menuitemcheckbox named "Show formulas" in the current page.
  await visible(named(page, "menuitemcheckbox", "Show formulas")); await named(page, "menuitemcheckbox", "Show formulas").click();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "=A1*4".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("=A1*4");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "3".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("3");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "=A1*4".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("=A1*4");
  // WHEN: The user clicks the button named "View" in the current page.
  await button(page, "View");
  // THEN: The menuitemcheckbox named "Show formulas" in the current page has checked state "true".
  await visible(named(page, "menuitemcheckbox", "Show formulas")); await expect(named(page, "menuitemcheckbox", "Show formulas")).toBeChecked({ checked: true });
  // WHEN: The user clicks the menuitemcheckbox named "Show formulas" in the current page.
  await visible(named(page, "menuitemcheckbox", "Show formulas")); await named(page, "menuitemcheckbox", "Show formulas").click();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "12".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("12");
});

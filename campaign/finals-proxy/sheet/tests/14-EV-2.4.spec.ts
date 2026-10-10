import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.4: Find case-sensitive text", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Find EV-2.4" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=alpha, B2=Alpha, C3=ALPHA.
  // WHEN: The user activates "Find EV-2.4" in the current page.
  await activate(page, "Find EV-2.4");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Find and replace" in the current page.
  await button(page, "Find and replace");
  // WHEN: The user enters "Alpha" in the "Find" field in the dialog named "Find and replace".
  await fill(named(page, "dialog", "Find and replace"), "Find", "Alpha");
  // WHEN: The user checks "Match case" in the dialog named "Find and replace".
  await checked(named(page, "dialog", "Find and replace"), "Match case", true);
  // WHEN: The user clicks the button named "Find next" in the dialog named "Find and replace".
  await button(named(page, "dialog", "Find and replace"), "Find next");
  // THEN: The exact text "Match B2" is visible exactly once in the dialog named "Find and replace".
  await text(named(page, "dialog", "Find and replace"), "Match B2");
  // WHEN: The user clicks the button named "Close" in the dialog named "Find and replace".
  await button(named(page, "dialog", "Find and replace"), "Close");
  // THEN: The gridcell named "B2" in the grid named "Worksheet grid" has selected state "true".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")).toHaveAttribute("aria-selected", "true");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "alpha".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("alpha");
});

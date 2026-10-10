import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.10: Make an independent workbook copy", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Make EV-3.10" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=6,B1 has formula =A1*3. No workbook named "Independent EV-3.10" exists.
  // WHEN: The user activates "Make EV-3.10" in the current page.
  await activate(page, "Make EV-3.10");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Make a copy" in the current page.
  await button(page, "Make a copy");
  // WHEN: The user enters "Independent EV-3.10" in the "Workbook name" field in the dialog named "Copy workbook".
  await fill(named(page, "dialog", "Copy workbook"), "Workbook name", "Independent EV-3.10");
  // WHEN: The user clicks the button named "Create copy" in the dialog named "Copy workbook".
  await button(named(page, "dialog", "Copy workbook"), "Create copy");
  // THEN: The heading named "Independent EV-3.10" is visible exactly once in the current page.
  await visible(named(page, "heading", "Independent EV-3.10"));
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // WHEN: The user enters "7" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "7");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "21".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("21");
  // WHEN: The user returns to the application home entry.
  await page.goto('/');
  // WHEN: The user activates "Make EV-3.10" in the current page.
  await activate(page, "Make EV-3.10");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "6".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("6");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "18".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("18");
  // WHEN: The user returns to the application home entry.
  await page.goto('/');
  // WHEN: The user activates "Independent EV-3.10" in the current page.
  await activate(page, "Independent EV-3.10");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "21".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("21");
});

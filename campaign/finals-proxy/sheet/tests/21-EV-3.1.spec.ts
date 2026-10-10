import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.1: Attach a note to a cell", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Attach EV-3.1" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=42.
  // WHEN: The user activates "Attach EV-3.1" in the current page.
  await activate(page, "Attach EV-3.1");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // WHEN: The user clicks the button named "Insert note" in the current page.
  await button(page, "Insert note");
  // WHEN: The user enters "Verified total EV-3.1" in the "Note" field in the dialog named "Cell note".
  await fill(named(page, "dialog", "Cell note"), "Note", "Verified total EV-3.1");
  // WHEN: The user clicks the button named "Save" in the dialog named "Cell note".
  await button(named(page, "dialog", "Cell note"), "Save");
  // WHEN: The user reloads the current page.
  await page.reload();
  // WHEN: The user clicks the button named "Show note for A1" in the current page.
  await button(page, "Show note for A1");
  // THEN: The "Note" field in the dialog named "Cell note" displays "Verified total EV-3.1".
  await visible(field(named(page, "dialog", "Cell note"), "Note")); await expect(field(named(page, "dialog", "Cell note"), "Note")).toHaveValue("Verified total EV-3.1");
  // WHEN: The user clicks the button named "Close" in the dialog named "Cell note".
  await button(named(page, "dialog", "Cell note"), "Close");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "42".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("42");
});

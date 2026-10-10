import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.2: Edit then remove a cell note", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Edit EV-3.2" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=42 with note "Old note EV-3.2".
  // WHEN: The user activates "Edit EV-3.2" in the current page.
  await activate(page, "Edit EV-3.2");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "Show note for A1" in the current page.
  await button(page, "Show note for A1");
  // WHEN: The user enters "Updated note EV-3.2" in the "Note" field in the dialog named "Cell note".
  await fill(named(page, "dialog", "Cell note"), "Note", "Updated note EV-3.2");
  // WHEN: The user clicks the button named "Save" in the dialog named "Cell note".
  await button(named(page, "dialog", "Cell note"), "Save");
  // WHEN: The user reloads the current page.
  await page.reload();
  // WHEN: The user clicks the button named "Show note for A1" in the current page.
  await button(page, "Show note for A1");
  // THEN: The "Note" field in the dialog named "Cell note" displays "Updated note EV-3.2".
  await visible(field(named(page, "dialog", "Cell note"), "Note")); await expect(field(named(page, "dialog", "Cell note"), "Note")).toHaveValue("Updated note EV-3.2");
  // WHEN: The user clicks the button named "Delete note" in the dialog named "Cell note".
  await button(named(page, "dialog", "Cell note"), "Delete note");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The button named "Show note for A1" is absent in the current page.
  await expect(named(page, "button", "Show note for A1")).toHaveCount(0);
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "42".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("42");
});

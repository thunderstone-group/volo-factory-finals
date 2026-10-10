import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.4: Split a selected column by a delimiter", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Split EV-3.4" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1="red,green,blue", A2="one,,three"; D1=Outside. Destination B1:C2 is blank.
  // WHEN: The user activates "Split EV-3.4" in the current page.
  await activate(page, "Split EV-3.4");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user drags from gridcell "A1" to gridcell "A2" in the grid named "Worksheet grid".
  { await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").scrollIntoViewIfNeeded(); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A2").scrollIntoViewIfNeeded(); const a = (await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").boundingBox())!; const b = (await named(named(page, "grid", "Worksheet grid"), "gridcell", "A2").boundingBox())!; await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up(); }
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Split text to columns" in the current page.
  await visible(named(page, "menuitem", "Split text to columns")); await named(page, "menuitem", "Split text to columns").click();
  // WHEN: The user selects "Comma" in the "Separator" combobox in the dialog named "Split text to columns".
  await choose(named(page, "dialog", "Split text to columns"), "Separator", "Comma");
  // WHEN: The user clicks the button named "Split" in the dialog named "Split text to columns".
  await button(named(page, "dialog", "Split text to columns"), "Split");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "red".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("red");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "green".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("green");
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "blue".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("blue");
  // THEN: The gridcell named "B2" in the grid named "Worksheet grid" has exact text "".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")).toHaveText("");
  // THEN: The gridcell named "C2" in the grid named "Worksheet grid" has exact text "three".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C2")).toHaveText("three");
  // THEN: The gridcell named "D1" in the grid named "Worksheet grid" has exact text "Outside".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")).toHaveText("Outside");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "C2" in the grid named "Worksheet grid" has exact text "three".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C2")).toHaveText("three");
});

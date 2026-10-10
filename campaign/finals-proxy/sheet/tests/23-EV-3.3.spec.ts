import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.3: Trim whitespace only in the selection", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Trim EV-3.3" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1="  North   East  ", A2="  West  ", B1="  Outside  ".
  // WHEN: The user activates "Trim EV-3.3" in the current page.
  await activate(page, "Trim EV-3.3");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user drags from gridcell "A1" to gridcell "A2" in the grid named "Worksheet grid".
  { await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").scrollIntoViewIfNeeded(); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A2").scrollIntoViewIfNeeded(); const a = (await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").boundingBox())!; const b = (await named(named(page, "grid", "Worksheet grid"), "gridcell", "A2").boundingBox())!; await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up(); }
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Trim whitespace" in the current page.
  await visible(named(page, "menuitem", "Trim whitespace")); await named(page, "menuitem", "Trim whitespace").click();
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "North East".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("North East");
  // THEN: The gridcell named "A2" in the grid named "Worksheet grid" has exact text "West".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")).toHaveText("West");
  // THEN: The gridcell named "B1" in the grid named "Worksheet grid" has exact text "  Outside  ".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")).toHaveText("  Outside  ");
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // THEN: The "Formula bar" field in the current page displays "North East".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("North East");
  // WHEN: The user clicks the gridcell named "A2" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A2").click();
  // THEN: The "Formula bar" field in the current page displays "West".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("West");
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // THEN: The "Formula bar" field in the current page displays "  Outside  ".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("  Outside  ");
  // WHEN: The user clicks the button named "Undo" in the current page.
  await button(page, "Undo");
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // THEN: The "Formula bar" field in the current page displays "  North   East  ".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("  North   East  ");
  // WHEN: The user clicks the button named "Redo" in the current page.
  await button(page, "Redo");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "North East".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("North East");
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // THEN: The "Formula bar" field in the current page displays "North East".
  await visible(field(page, "Formula bar")); await expect(field(page, "Formula bar")).toHaveValue("North East");
});

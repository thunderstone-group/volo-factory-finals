import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.5: Remove duplicate records from a range", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Remove EV-3.5" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=Name,B1=Count; A2=Apple,B2=2; A3=Pear,B3=3; A4=Apple,B4=2; D4=Outside.
  // WHEN: The user activates "Remove EV-3.5" in the current page.
  await activate(page, "Remove EV-3.5");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user drags from gridcell "A1" to gridcell "B4" in the grid named "Worksheet grid".
  { await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B4")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").scrollIntoViewIfNeeded(); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B4").scrollIntoViewIfNeeded(); const a = (await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").boundingBox())!; const b = (await named(named(page, "grid", "Worksheet grid"), "gridcell", "B4").boundingBox())!; await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up(); }
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Remove duplicates" in the current page.
  await visible(named(page, "menuitem", "Remove duplicates")); await named(page, "menuitem", "Remove duplicates").click();
  // WHEN: The user checks "Data has header row" in the dialog named "Remove duplicates".
  await checked(named(page, "dialog", "Remove duplicates"), "Data has header row", true);
  // WHEN: The user clicks the button named "Remove duplicates" in the dialog named "Remove duplicates".
  await button(named(page, "dialog", "Remove duplicates"), "Remove duplicates");
  // THEN: The exact text "1 duplicate removed" is visible exactly once in the current page.
  await text(page, "1 duplicate removed");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "Name".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("Name");
  // THEN: The gridcell named "A2" in the grid named "Worksheet grid" has exact text "Apple".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")).toHaveText("Apple");
  // THEN: The gridcell named "A3" in the grid named "Worksheet grid" has exact text "Pear".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A3")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A3")).toHaveText("Pear");
  // THEN: The gridcell named "A4" in the grid named "Worksheet grid" has exact text "".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A4")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A4")).toHaveText("");
  // THEN: The gridcell named "B4" in the grid named "Worksheet grid" has exact text "".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B4")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B4")).toHaveText("");
  // THEN: The gridcell named "D4" in the grid named "Worksheet grid" has exact text "Outside".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "D4")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "D4")).toHaveText("Outside");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "A3" in the grid named "Worksheet grid" has exact text "Pear".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A3")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A3")).toHaveText("Pear");
});

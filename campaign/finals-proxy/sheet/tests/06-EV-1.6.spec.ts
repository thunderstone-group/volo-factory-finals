import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.6: Sort by a secondary column", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Sort EV-1.6" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=Team,B1=Score; A2=Blue,B2=5; A3=Red,B3=3; A4=Blue,B4=9; D1=Sentinel.
  // WHEN: The user activates "Sort EV-1.6" in the current page.
  await activate(page, "Sort EV-1.6");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user drags from gridcell "A1" to gridcell "B4" in the grid named "Worksheet grid".
  { await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B4")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").scrollIntoViewIfNeeded(); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B4").scrollIntoViewIfNeeded(); const a = (await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").boundingBox())!; const b = (await named(named(page, "grid", "Worksheet grid"), "gridcell", "B4").boundingBox())!; await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up(); }
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Sort range" in the current page.
  await visible(named(page, "menuitem", "Sort range")); await named(page, "menuitem", "Sort range").click();
  // WHEN: The user checks "Data has header row" in the dialog named "Sort range".
  await checked(named(page, "dialog", "Sort range"), "Data has header row", true);
  // WHEN: The user selects "Team" in the "Sort by" combobox in the dialog named "Sort range".
  await choose(named(page, "dialog", "Sort range"), "Sort by", "Team");
  // WHEN: The user selects "Ascending" in the "Order" combobox in the dialog named "Sort range".
  await choose(named(page, "dialog", "Sort range"), "Order", "Ascending");
  // WHEN: The user selects "Score" in the "Then by" combobox in the dialog named "Sort range".
  await choose(named(page, "dialog", "Sort range"), "Then by", "Score");
  // WHEN: The user selects "Descending" in the "Then order" combobox in the dialog named "Sort range".
  await choose(named(page, "dialog", "Sort range"), "Then order", "Descending");
  // WHEN: The user clicks the button named "Sort" in the dialog named "Sort range".
  await button(named(page, "dialog", "Sort range"), "Sort");
  // THEN: The gridcell named "A2" in the grid named "Worksheet grid" has exact text "Blue".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A2")).toHaveText("Blue");
  // THEN: The gridcell named "B2" in the grid named "Worksheet grid" has exact text "9".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")).toHaveText("9");
  // THEN: The gridcell named "B3" in the grid named "Worksheet grid" has exact text "5".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B3")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B3")).toHaveText("5");
  // THEN: The gridcell named "A4" in the grid named "Worksheet grid" has exact text "Red".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A4")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A4")).toHaveText("Red");
  // THEN: The gridcell named "D1" in the grid named "Worksheet grid" has exact text "Sentinel".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "D1")).toHaveText("Sentinel");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "B2" in the grid named "Worksheet grid" has exact text "9".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "B2")).toHaveText("9");
});

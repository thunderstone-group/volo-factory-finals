import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.10: Concatenate cell text in a formula", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Concatenate EV-1.10" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=Order, B1=42.
  // WHEN: The user activates "Concatenate EV-1.10" in the current page.
  await activate(page, "Concatenate EV-1.10");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "C1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "C1").click();
  // WHEN: The user enters "=A1&\" #\"&B1" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "=A1&\" #\"&B1");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "Order #42".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("Order #42");
  // WHEN: The user clicks the gridcell named "B1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "B1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "B1").click();
  // WHEN: The user enters "43" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "43");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "Order #43".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("Order #43");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "C1" in the grid named "Worksheet grid" has exact text "Order #43".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "C1")).toHaveText("Order #43");
});

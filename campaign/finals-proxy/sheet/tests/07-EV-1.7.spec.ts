import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.7: Allow invalid input with a validation warning", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Allow EV-1.7" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. A1=5.
  // WHEN: The user activates "Allow EV-1.7" in the current page.
  await activate(page, "Allow EV-1.7");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Data validation" in the current page.
  await visible(named(page, "menuitem", "Data validation")); await named(page, "menuitem", "Data validation").click();
  // WHEN: The user selects "Number range" in the "Rule type" combobox in the dialog named "Data validation".
  await choose(named(page, "dialog", "Data validation"), "Rule type", "Number range");
  // WHEN: The user enters "0" in the "Minimum" field in the dialog named "Data validation".
  await fill(named(page, "dialog", "Data validation"), "Minimum", "0");
  // WHEN: The user enters "10" in the "Maximum" field in the dialog named "Data validation".
  await fill(named(page, "dialog", "Data validation"), "Maximum", "10");
  // WHEN: The user selects "Show warning" in the "On invalid data" combobox in the dialog named "Data validation".
  await choose(named(page, "dialog", "Data validation"), "On invalid data", "Show warning");
  // WHEN: The user clicks the button named "Save" in the dialog named "Data validation".
  await button(named(page, "dialog", "Data validation"), "Save");
  // WHEN: The user clicks the gridcell named "A1" in the grid named "Worksheet grid".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await named(named(page, "grid", "Worksheet grid"), "gridcell", "A1").click();
  // WHEN: The user enters "12" in the "Formula bar" field in the current page.
  await fill(page, "Formula bar", "12");
  // WHEN: The user presses "Enter" in the "Formula bar" field in the current page.
  await visible(field(page, "Formula bar")); await field(page, "Formula bar").press("Enter");
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "12".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("12");
  // THEN: The exact text "Validation warning" is visible exactly once in the current page.
  await text(page, "Validation warning");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The gridcell named "A1" in the grid named "Worksheet grid" has exact text "12".
  await visible(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")); await expect(named(named(page, "grid", "Worksheet grid"), "gridcell", "A1")).toHaveText("12");
  // WHEN: The user clicks the button named "Data" in the current page.
  await button(page, "Data");
  // WHEN: The user clicks the menuitem named "Data validation" in the current page.
  await visible(named(page, "menuitem", "Data validation")); await named(page, "menuitem", "Data validation").click();
  // THEN: The "On invalid data" combobox in the dialog named "Data validation" has selected option "Show warning".
  await selected(named(page, "dialog", "Data validation"), "On invalid data", "Show warning");
});

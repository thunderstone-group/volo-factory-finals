import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.6: Freeze the top worksheet row", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public workbook "Freeze EV-3.6" exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. Tabs are Sheet1 and Other; Sheet1!A1=Header, Other!A1=Other data. No rows are frozen.
  // WHEN: The user activates "Freeze EV-3.6" in the current page.
  await activate(page, "Freeze EV-3.6");
  // THEN: The grid named "Worksheet grid" is visible exactly once in the current page.
  await visible(named(page, "grid", "Worksheet grid"));
  // WHEN: The user clicks the button named "View" in the current page.
  await button(page, "View");
  // WHEN: The user clicks the menuitem named "Freeze rows" in the current page.
  await visible(named(page, "menuitem", "Freeze rows")); await named(page, "menuitem", "Freeze rows").click();
  // WHEN: The user enters "1" in the "Rows to freeze" field in the dialog named "Freeze rows".
  await fill(named(page, "dialog", "Freeze rows"), "Rows to freeze", "1");
  // WHEN: The user clicks the button named "Save" in the dialog named "Freeze rows".
  await button(named(page, "dialog", "Freeze rows"), "Save");
  // THEN: The exact text "1 row frozen" is visible exactly once in the region named "Frozen rows".
  await text(named(page, "region", "Frozen rows"), "1 row frozen");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "1 row frozen" is visible exactly once in the region named "Frozen rows".
  await text(named(page, "region", "Frozen rows"), "1 row frozen");
  // WHEN: The user clicks the tab named "Other" in the current page.
  await visible(named(page, "tab", "Other")); await named(page, "tab", "Other").click();
  // THEN: The exact text "0 rows frozen" is visible exactly once in the region named "Frozen rows".
  await text(named(page, "region", "Frozen rows"), "0 rows frozen");
  // WHEN: The user clicks the tab named "Sheet1" in the current page.
  await visible(named(page, "tab", "Sheet1")); await named(page, "tab", "Sheet1").click();
  // THEN: The exact text "1 row frozen" is visible exactly once in the region named "Frozen rows".
  await text(named(page, "region", "Frozen rows"), "1 row frozen");
});

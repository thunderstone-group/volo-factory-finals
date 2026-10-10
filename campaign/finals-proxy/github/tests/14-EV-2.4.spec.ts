import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.4: Restrict topic editing to administrators", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-2.4" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. Topics are api and docs.
  // GIVEN: The original verified account "issue-viewer" has email "issue-viewer@example.test" and password "Valid-password-123!". Its credentials are never changed by these scenarios.
  // WHEN: The user activates "Sign in" in the current page.
  await activate(page, "Sign in");
  // WHEN: The user enters "issue-viewer" in the "Username or email" field in the current page.
  await fill(page, "Username or email", "issue-viewer");
  // WHEN: The user enters "Valid-password-123!" in the "Password" field in the current page.
  await fill(page, "Password", "Valid-password-123!");
  // WHEN: The user clicks the button named "Sign in" in the current page.
  await button(page, "Sign in");
  // THEN: The button named "Account menu" is visible exactly once in the current page.
  await visible(named(page, "button", "Account menu"));
  // WHEN: The user enters "evolution-EV-2.4" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-2.4");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-2.4" in the current page.
  await activate(page, "evolution-EV-2.4");
  // THEN: The heading named "repo-admin/evolution-EV-2.4" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-2.4"));
  // THEN: The "Topics" list in the region named "About" contains exactly these entries in order: ["api", "docs"].
  await order(named(page, "region", "About"), "Topics", ["api", "docs"]);
  // THEN: The button named "Edit topics" is absent in the current page.
  await expect(named(page, "button", "Edit topics")).toHaveCount(0);
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The button named "Edit topics" is absent in the current page.
  await expect(named(page, "button", "Edit topics")).toHaveCount(0);
});

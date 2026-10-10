import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.4: Close an issue as not planned", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.4" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Declined EV-1.4" is Open, with description "Keep this description." and no closure reason.
  // GIVEN: The original verified account "repo-admin" has email "repo-admin@example.test" and password "Valid-password-123!". Its credentials are never changed by these scenarios.
  // WHEN: The user activates "Sign in" in the current page.
  await activate(page, "Sign in");
  // WHEN: The user enters "repo-admin" in the "Username or email" field in the current page.
  await fill(page, "Username or email", "repo-admin");
  // WHEN: The user enters "Valid-password-123!" in the "Password" field in the current page.
  await fill(page, "Password", "Valid-password-123!");
  // WHEN: The user clicks the button named "Sign in" in the current page.
  await button(page, "Sign in");
  // THEN: The button named "Account menu" is visible exactly once in the current page.
  await visible(named(page, "button", "Account menu"));
  // WHEN: The user enters "evolution-EV-1.4" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.4");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.4" in the current page.
  await activate(page, "evolution-EV-1.4");
  // THEN: The heading named "repo-admin/evolution-EV-1.4" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.4"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Declined EV-1.4" in the current page.
  await activate(page, "Declined EV-1.4");
  // THEN: The heading named "Declined EV-1.4" is visible exactly once in the current page.
  await visible(named(page, "heading", "Declined EV-1.4"));
  // WHEN: The user selects "Not planned" in the "Close reason" combobox in the region named "Issue".
  await choose(named(page, "region", "Issue"), "Close reason", "Not planned");
  // WHEN: The user clicks the button named "Close issue" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Close issue");
  // THEN: The exact text "Closed as not planned" is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Closed as not planned");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "Closed as not planned" is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Closed as not planned");
  // THEN: The exact text "Keep this description." is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Keep this description.");
  // WHEN: The user clicks the button named "Reopen issue" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Reopen issue");
  // THEN: The exact text "Open" is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Open");
  // THEN: The status named "Closed as not planned" is absent in the region named "Issue".
  await expect(named(named(page, "region", "Issue"), "status", "Closed as not planned")).toHaveCount(0);
});

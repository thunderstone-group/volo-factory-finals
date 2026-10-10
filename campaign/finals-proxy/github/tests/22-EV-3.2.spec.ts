import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.2: Deny issue locking to a read user", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-3.2" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Lock permission EV-3.2" is Open, unlocked, with description "Readable content.".
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
  // WHEN: The user enters "evolution-EV-3.2" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-3.2");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-3.2" in the current page.
  await activate(page, "evolution-EV-3.2");
  // THEN: The heading named "repo-admin/evolution-EV-3.2" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-3.2"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Lock permission EV-3.2" in the current page.
  await activate(page, "Lock permission EV-3.2");
  // THEN: The heading named "Lock permission EV-3.2" is visible exactly once in the current page.
  await visible(named(page, "heading", "Lock permission EV-3.2"));
  // THEN: The exact text "Readable content." is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Readable content.");
  // THEN: The button named "Lock conversation" is absent in the region named "Issue".
  await expect(named(named(page, "region", "Issue"), "button", "Lock conversation")).toHaveCount(0);
  // THEN: The button named "Unlock conversation" is absent in the region named "Issue".
  await expect(named(named(page, "region", "Issue"), "button", "Unlock conversation")).toHaveCount(0);
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The button named "Lock conversation" is absent in the region named "Issue".
  await expect(named(named(page, "region", "Issue"), "button", "Lock conversation")).toHaveCount(0);
});

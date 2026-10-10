import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.1: Lock an issue conversation", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-3.1" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Lock EV-3.1" is Open and unlocked, with description "Retain context.".
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
  // WHEN: The user enters "evolution-EV-3.1" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-3.1");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-3.1" in the current page.
  await activate(page, "evolution-EV-3.1");
  // THEN: The heading named "repo-admin/evolution-EV-3.1" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-3.1"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Lock EV-3.1" in the current page.
  await activate(page, "Lock EV-3.1");
  // THEN: The heading named "Lock EV-3.1" is visible exactly once in the current page.
  await visible(named(page, "heading", "Lock EV-3.1"));
  // WHEN: The user clicks the button named "Lock conversation" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Lock conversation");
  // WHEN: The user selects "Off-topic" in the "Lock reason" combobox in the dialog named "Lock conversation".
  await choose(named(page, "dialog", "Lock conversation"), "Lock reason", "Off-topic");
  // WHEN: The user clicks the button named "Lock" in the dialog named "Lock conversation".
  await button(named(page, "dialog", "Lock conversation"), "Lock");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "Locked: Off-topic" is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Locked: Off-topic");
  // WHEN: The user clicks the button named "Account menu" in the current page.
  await button(page, "Account menu");
  // WHEN: The user activates "Sign out" in the current page.
  await activate(page, "Sign out");
  // THEN: The dialog named "Sign out" is visible exactly once in the current page.
  await visible(named(page, "dialog", "Sign out"));
  // WHEN: The user clicks the button named "Confirm sign out" in the dialog named "Sign out".
  await button(named(page, "dialog", "Sign out"), "Confirm sign out");
  // THEN: The link named "Sign in" is visible exactly once in the current page.
  await visible(named(page, "link", "Sign in"));
  // GIVEN: The original verified account "issue-commenter" has email "issue-commenter@example.test" and password "Valid-password-123!". Its credentials are never changed by these scenarios.
  // WHEN: The user activates "Sign in" in the current page.
  await activate(page, "Sign in");
  // WHEN: The user enters "issue-commenter" in the "Username or email" field in the current page.
  await fill(page, "Username or email", "issue-commenter");
  // WHEN: The user enters "Valid-password-123!" in the "Password" field in the current page.
  await fill(page, "Password", "Valid-password-123!");
  // WHEN: The user clicks the button named "Sign in" in the current page.
  await button(page, "Sign in");
  // THEN: The button named "Account menu" is visible exactly once in the current page.
  await visible(named(page, "button", "Account menu"));
  // WHEN: The user enters "evolution-EV-3.1" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-3.1");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-3.1" in the current page.
  await activate(page, "evolution-EV-3.1");
  // THEN: The heading named "repo-admin/evolution-EV-3.1" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-3.1"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Lock EV-3.1" in the current page.
  await activate(page, "Lock EV-3.1");
  // THEN: The heading named "Lock EV-3.1" is visible exactly once in the current page.
  await visible(named(page, "heading", "Lock EV-3.1"));
  // THEN: The button named "Comment" is absent in the region named "Issue".
  await expect(named(named(page, "region", "Issue"), "button", "Comment")).toHaveCount(0);
  // THEN: The exact text "Retain context." is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Retain context.");
});

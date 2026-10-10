import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.5: Preview a Markdown issue comment", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.5" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Preview EV-1.5" is Open and has no comments.
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
  // WHEN: The user enters "evolution-EV-1.5" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.5");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.5" in the current page.
  await activate(page, "evolution-EV-1.5");
  // THEN: The heading named "repo-admin/evolution-EV-1.5" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.5"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Preview EV-1.5" in the current page.
  await activate(page, "Preview EV-1.5");
  // THEN: The heading named "Preview EV-1.5" is visible exactly once in the current page.
  await visible(named(page, "heading", "Preview EV-1.5"));
  // WHEN: The user enters "**Reviewed** carefully." in the "Comment" field in the current page.
  await fill(page, "Comment", "**Reviewed** carefully.");
  // WHEN: The user clicks the button named "Preview" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Preview");
  // THEN: The exact text "Reviewed" is visible exactly once in the region named "Comment preview".
  await text(named(page, "region", "Comment preview"), "Reviewed");
  // WHEN: The user clicks the button named "Write" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Write");
  // THEN: The "Comment" field in the current page displays "**Reviewed** carefully.".
  await visible(field(page, "Comment")); await expect(field(page, "Comment")).toHaveValue("**Reviewed** carefully.");
  // WHEN: The user clicks the button named "Comment" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Comment");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "Reviewed carefully." is visible exactly once in the region named "Discussion".
  await text(named(page, "region", "Discussion"), "Reviewed carefully.");
});

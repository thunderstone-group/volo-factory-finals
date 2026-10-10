import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.6: Create and use a saved reply", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-3.6" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Reply EV-3.6" is Open with no comments. issue-commenter has no saved reply "Thanks EV-3.6".
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
  // WHEN: The user enters "evolution-EV-3.6" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-3.6");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-3.6" in the current page.
  await activate(page, "evolution-EV-3.6");
  // THEN: The heading named "repo-admin/evolution-EV-3.6" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-3.6"));
  // WHEN: The user clicks the button named "Account menu" in the current page.
  await button(page, "Account menu");
  // WHEN: The user activates "Saved replies" in the current page.
  await activate(page, "Saved replies");
  // WHEN: The user clicks the button named "New saved reply" in the current page.
  await button(page, "New saved reply");
  // WHEN: The user enters "Thanks EV-3.6" in the "Reply title" field in the dialog named "Saved reply".
  await fill(named(page, "dialog", "Saved reply"), "Reply title", "Thanks EV-3.6");
  // WHEN: The user enters "Thanks for the reproducible example." in the "Reply body" field in the dialog named "Saved reply".
  await fill(named(page, "dialog", "Saved reply"), "Reply body", "Thanks for the reproducible example.");
  // WHEN: The user clicks the button named "Save" in the dialog named "Saved reply".
  await button(named(page, "dialog", "Saved reply"), "Save");
  // WHEN: The user returns to the application home entry.
  await page.goto('/');
  // WHEN: The user enters "evolution-EV-3.6" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-3.6");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-3.6" in the current page.
  await activate(page, "evolution-EV-3.6");
  // THEN: The heading named "repo-admin/evolution-EV-3.6" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-3.6"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Reply EV-3.6" in the current page.
  await activate(page, "Reply EV-3.6");
  // THEN: The heading named "Reply EV-3.6" is visible exactly once in the current page.
  await visible(named(page, "heading", "Reply EV-3.6"));
  // WHEN: The user clicks the button named "Insert saved reply" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Insert saved reply");
  // WHEN: The user clicks the option named "Thanks EV-3.6" in the current page.
  await visible(named(page, "option", "Thanks EV-3.6")); await named(page, "option", "Thanks EV-3.6").click();
  // THEN: The "Comment" field in the current page displays "Thanks for the reproducible example.".
  await visible(field(page, "Comment")); await expect(field(page, "Comment")).toHaveValue("Thanks for the reproducible example.");
  // WHEN: The user clicks the button named "Comment" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Comment");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "Thanks for the reproducible example." is visible exactly once in the region named "Discussion".
  await text(named(page, "region", "Discussion"), "Thanks for the reproducible example.");
});

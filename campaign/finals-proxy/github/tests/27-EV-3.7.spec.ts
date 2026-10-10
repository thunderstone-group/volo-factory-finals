import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.7: Edit an authored issue comment", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-3.7" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Edit comment EV-3.7" has exactly one comment with body "Original comment EV-3.7", by issue-commenter, whose article accessible name is "Comment by issue-commenter".
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
  // WHEN: The user enters "evolution-EV-3.7" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-3.7");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-3.7" in the current page.
  await activate(page, "evolution-EV-3.7");
  // THEN: The heading named "repo-admin/evolution-EV-3.7" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-3.7"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Edit comment EV-3.7" in the current page.
  await activate(page, "Edit comment EV-3.7");
  // THEN: The heading named "Edit comment EV-3.7" is visible exactly once in the current page.
  await visible(named(page, "heading", "Edit comment EV-3.7"));
  // WHEN: The user clicks the button named "Edit comment" in the article named "Comment by issue-commenter".
  await button(named(page, "article", "Comment by issue-commenter"), "Edit comment");
  // WHEN: The user enters "Revised comment EV-3.7" in the "Comment body" field in the dialog named "Edit comment".
  await fill(named(page, "dialog", "Edit comment"), "Comment body", "Revised comment EV-3.7");
  // WHEN: The user clicks the button named "Save comment" in the dialog named "Edit comment".
  await button(named(page, "dialog", "Edit comment"), "Save comment");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "Revised comment EV-3.7" is visible exactly once in the article named "Comment by issue-commenter".
  await text(named(page, "article", "Comment by issue-commenter"), "Revised comment EV-3.7");
  // THEN: The exact text "Edited" is visible exactly once in the article named "Comment by issue-commenter".
  await text(named(page, "article", "Comment by issue-commenter"), "Edited");
  // THEN: The button named "Save comment" is absent in the current page.
  await expect(named(page, "button", "Save comment")).toHaveCount(0);
});

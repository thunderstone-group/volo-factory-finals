import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.8: Confirm deletion of an authored comment", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-3.8" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Delete comment EV-3.8" has description "Keep the issue body." and one issue-commenter comment "Disposable EV-3.8" in article "Comment by issue-commenter".
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
  // WHEN: The user enters "evolution-EV-3.8" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-3.8");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-3.8" in the current page.
  await activate(page, "evolution-EV-3.8");
  // THEN: The heading named "repo-admin/evolution-EV-3.8" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-3.8"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Delete comment EV-3.8" in the current page.
  await activate(page, "Delete comment EV-3.8");
  // THEN: The heading named "Delete comment EV-3.8" is visible exactly once in the current page.
  await visible(named(page, "heading", "Delete comment EV-3.8"));
  // WHEN: The user clicks the button named "Delete comment" in the article named "Comment by issue-commenter".
  await button(named(page, "article", "Comment by issue-commenter"), "Delete comment");
  // WHEN: The user clicks the button named "Cancel" in the dialog named "Delete comment".
  await button(named(page, "dialog", "Delete comment"), "Cancel");
  // THEN: The exact text "Disposable EV-3.8" is visible exactly once in the region named "Discussion".
  await text(named(page, "region", "Discussion"), "Disposable EV-3.8");
  // WHEN: The user clicks the button named "Delete comment" in the article named "Comment by issue-commenter".
  await button(named(page, "article", "Comment by issue-commenter"), "Delete comment");
  // WHEN: The user clicks the button named "Delete" in the dialog named "Delete comment".
  await button(named(page, "dialog", "Delete comment"), "Delete");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The article named "Comment by issue-commenter" is absent in the region named "Discussion".
  await expect(named(named(page, "region", "Discussion"), "article", "Comment by issue-commenter")).toHaveCount(0);
  // THEN: The exact text "Keep the issue body." is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "Keep the issue body.");
});

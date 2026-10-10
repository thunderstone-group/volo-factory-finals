import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.9: Search labels before applying one", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.9" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Label search EV-1.9" is Open and unlabeled. Repository labels are bug, documentation and enhancement.
  // GIVEN: The original verified account "issue-editor" has email "issue-editor@example.test" and password "Valid-password-123!". Its credentials are never changed by these scenarios.
  // WHEN: The user activates "Sign in" in the current page.
  await activate(page, "Sign in");
  // WHEN: The user enters "issue-editor" in the "Username or email" field in the current page.
  await fill(page, "Username or email", "issue-editor");
  // WHEN: The user enters "Valid-password-123!" in the "Password" field in the current page.
  await fill(page, "Password", "Valid-password-123!");
  // WHEN: The user clicks the button named "Sign in" in the current page.
  await button(page, "Sign in");
  // THEN: The button named "Account menu" is visible exactly once in the current page.
  await visible(named(page, "button", "Account menu"));
  // WHEN: The user enters "evolution-EV-1.9" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.9");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.9" in the current page.
  await activate(page, "evolution-EV-1.9");
  // THEN: The heading named "repo-admin/evolution-EV-1.9" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.9"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Label search EV-1.9" in the current page.
  await activate(page, "Label search EV-1.9");
  // THEN: The heading named "Label search EV-1.9" is visible exactly once in the current page.
  await visible(named(page, "heading", "Label search EV-1.9"));
  // WHEN: The user clicks the button named "Labels" in the region named "Issue".
  await button(named(page, "region", "Issue"), "Labels");
  // WHEN: The user enters "DOC" in the "Filter labels" field in the current page.
  await fill(page, "Filter labels", "DOC");
  // THEN: The option named "documentation" is visible exactly once in the current page.
  await visible(named(page, "option", "documentation"));
  // THEN: The option named "bug" is absent in the current page.
  await expect(named(page, "option", "bug")).toHaveCount(0);
  // WHEN: The user clicks the option named "documentation" in the current page.
  await visible(named(page, "option", "documentation")); await named(page, "option", "documentation").click();
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "documentation" is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "documentation");
});

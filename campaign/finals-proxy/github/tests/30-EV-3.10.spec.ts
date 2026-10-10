import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-3.10: Resolve and reopen a review thread", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-3.10" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. "Resolve EV-3.10" is an Open PR by pr-author. Files changed contains unresolved thread "Thread EV-3.10" with pr-reviewer comment "Handle the empty case." on src/search.ts.
  // GIVEN: The original verified account "pr-reviewer" has email "pr-reviewer@example.test" and password "Valid-password-123!". Its credentials are never changed by these scenarios.
  // WHEN: The user activates "Sign in" in the current page.
  await activate(page, "Sign in");
  // WHEN: The user enters "pr-reviewer" in the "Username or email" field in the current page.
  await fill(page, "Username or email", "pr-reviewer");
  // WHEN: The user enters "Valid-password-123!" in the "Password" field in the current page.
  await fill(page, "Password", "Valid-password-123!");
  // WHEN: The user clicks the button named "Sign in" in the current page.
  await button(page, "Sign in");
  // THEN: The button named "Account menu" is visible exactly once in the current page.
  await visible(named(page, "button", "Account menu"));
  // WHEN: The user enters "evolution-EV-3.10" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-3.10");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-3.10" in the current page.
  await activate(page, "evolution-EV-3.10");
  // THEN: The heading named "repo-admin/evolution-EV-3.10" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-3.10"));
  // WHEN: The user activates "Pull requests" in the current page.
  await activate(page, "Pull requests");
  // WHEN: The user activates "Resolve EV-3.10" in the current page.
  await activate(page, "Resolve EV-3.10");
  // THEN: The heading named "Resolve EV-3.10" is visible exactly once in the current page.
  await visible(named(page, "heading", "Resolve EV-3.10"));
  // WHEN: The user activates "Files changed" in the current page.
  await activate(page, "Files changed");
  // WHEN: The user clicks the button named "Resolve conversation" in the region named "Thread EV-3.10".
  await button(named(page, "region", "Thread EV-3.10"), "Resolve conversation");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "Resolved" is visible exactly once in the region named "Thread EV-3.10".
  await text(named(page, "region", "Thread EV-3.10"), "Resolved");
  // THEN: The exact text "Handle the empty case." is visible exactly once in the region named "Thread EV-3.10".
  await text(named(page, "region", "Thread EV-3.10"), "Handle the empty case.");
  // WHEN: The user clicks the button named "Unresolve conversation" in the region named "Thread EV-3.10".
  await button(named(page, "region", "Thread EV-3.10"), "Unresolve conversation");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The button named "Resolve conversation" is visible exactly once in the region named "Thread EV-3.10".
  await visible(named(named(page, "region", "Thread EV-3.10"), "button", "Resolve conversation"));
});

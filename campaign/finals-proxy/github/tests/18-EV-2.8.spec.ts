import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.8: Rename an applied repository label", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-2.8" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. Label old-ev-2.8 with description "Old description" and color #aaaaaa is applied to "Linked EV-2.8".
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
  // WHEN: The user enters "evolution-EV-2.8" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-2.8");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-2.8" in the current page.
  await activate(page, "evolution-EV-2.8");
  // THEN: The heading named "repo-admin/evolution-EV-2.8" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-2.8"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Labels" in the current page.
  await activate(page, "Labels");
  // WHEN: The user clicks the button named "Edit" in the region named "old-ev-2.8".
  await button(named(page, "region", "old-ev-2.8"), "Edit");
  // WHEN: The user enters "renamed-ev-2.8" in the "Label name" field in the dialog named "Edit label".
  await fill(named(page, "dialog", "Edit label"), "Label name", "renamed-ev-2.8");
  // WHEN: The user enters "New description" in the "Description" field in the dialog named "Edit label".
  await fill(named(page, "dialog", "Edit label"), "Description", "New description");
  // WHEN: The user clicks the button named "Save" in the dialog named "Edit label".
  await button(named(page, "dialog", "Edit label"), "Save");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The region named "renamed-ev-2.8" is visible exactly once in the current page.
  await visible(named(page, "region", "renamed-ev-2.8"));
  // THEN: The region named "old-ev-2.8" is absent in the current page.
  await expect(named(page, "region", "old-ev-2.8")).toHaveCount(0);
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user activates "Linked EV-2.8" in the current page.
  await activate(page, "Linked EV-2.8");
  // THEN: The exact text "renamed-ev-2.8" is visible exactly once in the region named "Issue".
  await text(named(page, "region", "Issue"), "renamed-ev-2.8");
});

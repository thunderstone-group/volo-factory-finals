import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-2.5: Archive a repository", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-2.5" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. The repository is active with one Open issue "Preserved EV-2.5".
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
  // WHEN: The user enters "evolution-EV-2.5" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-2.5");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-2.5" in the current page.
  await activate(page, "evolution-EV-2.5");
  // THEN: The heading named "repo-admin/evolution-EV-2.5" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-2.5"));
  // WHEN: The user activates "Settings" in the current page.
  await activate(page, "Settings");
  // WHEN: The user activates "General" in the current page.
  await activate(page, "General");
  // WHEN: The user clicks the button named "Archive repository" in the current page.
  await button(page, "Archive repository");
  // WHEN: The user enters "evolution-EV-2.5" in the "Repository name" field in the dialog named "Archive repository".
  await fill(named(page, "dialog", "Archive repository"), "Repository name", "evolution-EV-2.5");
  // WHEN: The user clicks the button named "Archive" in the dialog named "Archive repository".
  await button(named(page, "dialog", "Archive repository"), "Archive");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "Archived" is visible exactly once in the region named "Repository status".
  await text(named(page, "region", "Repository status"), "Archived");
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // THEN: The link named "Preserved EV-2.5" is visible exactly once in the current page.
  await visible(named(page, "link", "Preserved EV-2.5"));
  // THEN: The link named "New issue" is absent in the current page.
  await expect(named(page, "link", "New issue")).toHaveCount(0);
  // THEN: The button named "New issue" is absent in the current page.
  await expect(named(page, "button", "New issue")).toHaveCount(0);
});

import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.6: Preview a Markdown file before committing", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.6" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. main contains README.md with "Initial file". docs/guide.md does not exist.
  // GIVEN: The original verified account "file-contributor" has email "file-contributor@example.test" and password "Valid-password-123!". Its credentials are never changed by these scenarios.
  // WHEN: The user activates "Sign in" in the current page.
  await activate(page, "Sign in");
  // WHEN: The user enters "file-contributor" in the "Username or email" field in the current page.
  await fill(page, "Username or email", "file-contributor");
  // WHEN: The user enters "Valid-password-123!" in the "Password" field in the current page.
  await fill(page, "Password", "Valid-password-123!");
  // WHEN: The user clicks the button named "Sign in" in the current page.
  await button(page, "Sign in");
  // THEN: The button named "Account menu" is visible exactly once in the current page.
  await visible(named(page, "button", "Account menu"));
  // WHEN: The user enters "evolution-EV-1.6" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.6");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.6" in the current page.
  await activate(page, "evolution-EV-1.6");
  // THEN: The heading named "repo-admin/evolution-EV-1.6" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.6"));
  // WHEN: The user activates "Add file" in the current page.
  await activate(page, "Add file");
  // WHEN: The user activates "Create new file" in the current page.
  await activate(page, "Create new file");
  // WHEN: The user enters "docs/guide.md" in the "File name" field in the current page.
  await fill(page, "File name", "docs/guide.md");
  // WHEN: The user enters "# Guide EV-1.6\n\n**Useful** documentation." in the "File contents" field in the current page.
  await fill(page, "File contents", "# Guide EV-1.6\n\n**Useful** documentation.");
  // WHEN: The user clicks the button named "Preview file" in the current page.
  await button(page, "Preview file");
  // THEN: The heading named "Guide EV-1.6" is visible exactly once in the region named "File preview".
  await visible(named(named(page, "region", "File preview"), "heading", "Guide EV-1.6"));
  // WHEN: The user clicks the button named "Edit file" in the current page.
  await button(page, "Edit file");
  // THEN: The "File contents" field in the current page displays "# Guide EV-1.6\n\n**Useful** documentation.".
  await visible(field(page, "File contents")); await expect(field(page, "File contents")).toHaveValue("# Guide EV-1.6\n\n**Useful** documentation.");
  // WHEN: The user enters "Add guide EV-1.6" in the "Commit message" field in the current page.
  await fill(page, "Commit message", "Add guide EV-1.6");
  // WHEN: The user clicks the button named "Commit changes" in the current page.
  await button(page, "Commit changes");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "docs/guide.md" is visible exactly once in the current page.
  await text(page, "docs/guide.md");
});

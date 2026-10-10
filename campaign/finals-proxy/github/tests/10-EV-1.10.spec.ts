import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.10: Swap comparison branches", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.10" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. main and feature-ev-1.10 are distinct branches with differences; file src/compare.txt differs between them.
  // GIVEN: The original verified account "pr-contributor" has email "pr-contributor@example.test" and password "Valid-password-123!". Its credentials are never changed by these scenarios.
  // WHEN: The user activates "Sign in" in the current page.
  await activate(page, "Sign in");
  // WHEN: The user enters "pr-contributor" in the "Username or email" field in the current page.
  await fill(page, "Username or email", "pr-contributor");
  // WHEN: The user enters "Valid-password-123!" in the "Password" field in the current page.
  await fill(page, "Password", "Valid-password-123!");
  // WHEN: The user clicks the button named "Sign in" in the current page.
  await button(page, "Sign in");
  // THEN: The button named "Account menu" is visible exactly once in the current page.
  await visible(named(page, "button", "Account menu"));
  // WHEN: The user enters "evolution-EV-1.10" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.10");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.10" in the current page.
  await activate(page, "evolution-EV-1.10");
  // THEN: The heading named "repo-admin/evolution-EV-1.10" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.10"));
  // WHEN: The user activates "Pull requests" in the current page.
  await activate(page, "Pull requests");
  // WHEN: The user activates "New pull request" in the current page.
  await activate(page, "New pull request");
  // WHEN: The user selects "main" in the "Base" combobox in the current page.
  await choose(page, "Base", "main");
  // WHEN: The user selects "feature-ev-1.10" in the "Compare" combobox in the current page.
  await choose(page, "Compare", "feature-ev-1.10");
  // WHEN: The user clicks the button named "Swap branches" in the current page.
  await button(page, "Swap branches");
  // THEN: The "Base" combobox in the current page has selected option "feature-ev-1.10".
  await selected(page, "Base", "feature-ev-1.10");
  // THEN: The "Compare" combobox in the current page has selected option "main".
  await selected(page, "Compare", "main");
  // WHEN: The user clicks the button named "Compare changes" in the current page.
  await button(page, "Compare changes");
  // THEN: The exact text "base: feature-ev-1.10; compare: main" is visible exactly once in the region named "Comparison summary".
  await text(named(page, "region", "Comparison summary"), "base: feature-ev-1.10; compare: main");
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The exact text "base: feature-ev-1.10; compare: main" is visible exactly once in the region named "Comparison summary".
  await text(named(page, "region", "Comparison summary"), "base: feature-ev-1.10; compare: main");
});

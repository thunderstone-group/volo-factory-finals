import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.3: Filter draft pull requests by author", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.3" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. PRs are "Draft EV-1.3" (Draft, pr-author), "Ready EV-1.3" (Open, pr-author), and "Other EV-1.3" (Draft, pr-contributor); all compare feature to main.
  // WHEN: The user enters "evolution-EV-1.3" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.3");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.3" in the current page.
  await activate(page, "evolution-EV-1.3");
  // THEN: The heading named "repo-admin/evolution-EV-1.3" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.3"));
  // WHEN: The user activates "Pull requests" in the current page.
  await activate(page, "Pull requests");
  // WHEN: The user enters "is:draft author:pr-author" in the "Search pull requests" field in the current page.
  await fill(page, "Search pull requests", "is:draft author:pr-author");
  // THEN: The "Pull request titles" list in the region named "Pull requests" contains exactly these entries in order: ["Draft EV-1.3"].
  await order(named(page, "region", "Pull requests"), "Pull request titles", ["Draft EV-1.3"]);
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The "Pull request titles" list in the region named "Pull requests" contains exactly these entries in order: ["Draft EV-1.3"].
  await order(named(page, "region", "Pull requests"), "Pull request titles", ["Draft EV-1.3"]);
});

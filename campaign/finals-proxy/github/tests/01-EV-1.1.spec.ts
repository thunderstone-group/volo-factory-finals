import { test, expect } from '@playwright/test';
import { named, field, visible, activate, button, fill, choose, checked, text, order, selected } from './helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.1: Filter issues with combined qualifiers", async ({ page }) => {
  // GIVEN: The user opens the application home entry in a fresh browser context, signed out.
  await page.goto('/');
  // GIVEN: The public repository "evolution-EV-1.1" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. Issues are "Bug EV-1.1" (Closed, label bug, author issue-editor), "Open EV-1.1" (Open, bug, issue-editor), and "Other EV-1.1" (Closed, docs, issue-commenter).
  // WHEN: The user enters "evolution-EV-1.1" in the "Search" field in the current page.
  await fill(page, "Search", "evolution-EV-1.1");
  // WHEN: The user presses "Enter" in the "Search" field in the current page.
  await visible(field(page, "Search")); await field(page, "Search").press("Enter");
  // WHEN: The user activates "evolution-EV-1.1" in the current page.
  await activate(page, "evolution-EV-1.1");
  // THEN: The heading named "repo-admin/evolution-EV-1.1" is visible exactly once in the current page.
  await visible(named(page, "heading", "repo-admin/evolution-EV-1.1"));
  // WHEN: The user activates "Issues" in the current page.
  await activate(page, "Issues");
  // WHEN: The user enters "is:closed label:bug author:issue-editor" in the "Search issues" field in the current page.
  await fill(page, "Search issues", "is:closed label:bug author:issue-editor");
  // THEN: The "Issue titles" list in the region named "Issues" contains exactly these entries in order: ["Bug EV-1.1"].
  await order(named(page, "region", "Issues"), "Issue titles", ["Bug EV-1.1"]);
  // THEN: The link named "Open EV-1.1" is absent in the region named "Issues".
  await expect(named(named(page, "region", "Issues"), "link", "Open EV-1.1")).toHaveCount(0);
  // WHEN: The user reloads the current page.
  await page.reload();
  // THEN: The "Issue titles" list in the region named "Issues" contains exactly these entries in order: ["Bug EV-1.1"].
  await order(named(page, "region", "Issues"), "Issue titles", ["Bug EV-1.1"]);
});
